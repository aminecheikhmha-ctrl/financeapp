import { NextRequest, NextResponse } from "next/server"
import { sendWelcomeEmail } from "@/lib/resend"

export async function POST(req: NextRequest) {
  try {
    const { email, username } = await req.json()
    if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 })
    await sendWelcomeEmail(email, username)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
