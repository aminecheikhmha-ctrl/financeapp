import { NextRequest, NextResponse } from "next/server"
import { moderate } from "@/lib/moderation"

export async function POST(req: NextRequest) {
  try {
    const { text, type = "post" } = await req.json()
    if (!text || typeof text !== "string") {
      return NextResponse.json({ approved: false, reason: "Contenu manquant.", severity: "low" })
    }
    const result = await moderate(text, type)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ approved: true, severity: "none" })
  }
}
