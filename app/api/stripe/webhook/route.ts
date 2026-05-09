import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")!

  let event: any

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    const email = session.customer_email

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
    const priceId = lineItems.data[0]?.price?.id

    let plan = "free"
    if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "pro"
    if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) plan = "premium"

    console.log("Email:", email, "PriceId:", priceId, "Plan:", plan)

    // Cherche l'utilisateur par email
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single()

    console.log("userData:", userData, "userError:", userError)

  const { error } = await supabase
      .from("profiles")
      .update({ plan })
      .eq("email", email)
    console.log("Update error:", error)
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object
    const customer = await stripe.customers.retrieve(subscription.customer) as any

    await supabase
      .from("profiles")
      .update({ plan: "free" })
      .eq("email", customer.email)
  }

  return NextResponse.json({ received: true })
}