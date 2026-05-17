import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

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

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
      const priceId = lineItems.data[0]?.price?.id

      let plan = "free"
      if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "pro"
      if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) plan = "premium"

      // Update by user_id if available, else by email in profiles table
      if (userId) {
        await supabase.from("user_profiles").upsert({ id: userId, plan }, { onConflict: "id" })
      }
      if (email) {
        await supabase.from("profiles").update({ plan }).eq("email", email)
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription
      const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer
      if (customer.email) {
        await supabase.from("profiles").update({ plan: "free" }).eq("email", customer.email)
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice
      const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer
      if (customer.email) {
        // Keep their plan but flag it - don't downgrade immediately on first failure
        await supabase.from("profiles").update({ payment_failed: true }).eq("email", customer.email)
      }
    }
  } catch (err) {
    // Log to stderr only, not stdout
    process.stderr.write(`[webhook] error: ${err}\n`)
  }

  return NextResponse.json({ received: true })
}
