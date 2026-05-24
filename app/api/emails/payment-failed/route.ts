import { NextRequest, NextResponse } from "next/server"
import { sendPaymentFailedEmail } from "@/lib/resend"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { email, username } = await req.json()
    if (!email) return NextResponse.json({ error: "email requis" }, { status: 400 })
    await sendPaymentFailedEmail(email, username)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
