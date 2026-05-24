import { NextRequest, NextResponse } from "next/server"
import { sendUpgradeEmail } from "@/lib/resend"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { email, plan, username } = await req.json()
    if (!email || !plan) return NextResponse.json({ error: "email et plan requis" }, { status: 400 })
    if (plan !== "pro" && plan !== "premium") return NextResponse.json({ error: "plan invalide" }, { status: 400 })
    await sendUpgradeEmail(email, plan, username)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
