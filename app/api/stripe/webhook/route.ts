import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { sendUpgradeEmail, sendPaymentFailedEmail } from "@/lib/resend"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const supabase = makeSupabase()

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      const email = session.customer_email
      const stripeCustomerId = session.customer as string | null

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
      const priceId = lineItems.data[0]?.price?.id

      let plan = "free"
      if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "pro"
      if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) plan = "premium"

      const now = new Date().toISOString()

      if (userId) {
        await supabase.from("user_profiles").upsert(
          { id: userId, plan, stripe_customer_id: stripeCustomerId, plan_started_at: now },
          { onConflict: "id" }
        )
      }
      if (email) {
        await supabase.from("profiles").update({
          plan,
          stripe_customer_id: stripeCustomerId,
          plan_started_at: now,
          plan_ended_at: null,
          payment_failed: false,
        }).eq("email", email)
      }

      // Send upgrade confirmation email
      if (email && (plan === "pro" || plan === "premium")) {
        await sendUpgradeEmail(email, plan as "pro" | "premium").catch(() => {})
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription
      const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer
      if (customer.email) {
        const now = new Date().toISOString()
        await supabase.from("profiles").update({
          plan: "free",
          plan_ended_at: now,
        }).eq("email", customer.email)
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice
      const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer
      if (customer.email) {
        await supabase.from("profiles").update({ payment_failed: true }).eq("email", customer.email)
        await sendPaymentFailedEmail(customer.email).catch(() => {})
      }
    }
  } catch (err) {
    process.stderr.write(`[webhook] error: ${err}\n`)
  }

  return NextResponse.json({ received: true })
}
