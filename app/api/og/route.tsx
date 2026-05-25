import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

const CATEGORY_COLORS: Record<string, string> = {
  "débutant":         "#4ade80",
  "analyse-technique": "#60a5fa",
  "crypto":           "#a78bfa",
  "stratégie":        "#f59e0b",
  "macro":            "#f87171",
  "psychologie":      "#fb923c",
  "actions":          "#34d399",
  "technologie":      "#22d3ee",
  "avancé":           "#e879f9",
  "analyses":         "#facc15",
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const title    = searchParams.get("title")    ?? "TradEx Blog"
  const category = searchParams.get("category") ?? "trading"
  const color    = CATEGORY_COLORS[category] ?? "#4ade80"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          background: "#080808",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          position: "relative",
        }}
      >
        {/* Background grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `radial-gradient(${color}18 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          display: "flex",
        }} />
        {/* Glow */}
        <div style={{
          position: "absolute", top: -100, right: -100,
          width: 400, height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}25 0%, transparent 70%)`,
          display: "flex",
        }} />

        {/* Top: Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #4ade80, #059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>F</span>
          </div>
          <span style={{ color: "#fff", fontWeight: 900, fontSize: 22 }}>TradEx</span>
          <div style={{
            marginLeft: 12,
            padding: "4px 12px", borderRadius: 20,
            background: `${color}20`,
            border: `1px solid ${color}40`,
            color,
            fontSize: 13, fontWeight: 700,
            textTransform: "capitalize",
            display: "flex",
          }}>
            {category}
          </div>
        </div>

        {/* Center: Title */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
          justifyContent: "center",
          paddingTop: 20,
          paddingBottom: 20,
        }}>
          <div style={{
            color: "#fff",
            fontSize: title.length > 50 ? 42 : 52,
            fontWeight: 900,
            lineHeight: 1.15,
            maxWidth: 900,
          }}>
            {title}
          </div>
          <div style={{ color: "#6b7280", fontSize: 18, marginTop: 8 }}>
            Blog TradEx — Apprendre à trader intelligemment
          </div>
        </div>

        {/* Bottom: URL */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 20,
        }}>
          <span style={{ color: "#4b5563", fontSize: 15 }}>tradex-kappa-six.vercel.app</span>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderRadius: 10,
            background: `${color}18`, border: `1px solid ${color}30`,
          }}>
            <span style={{ color, fontSize: 14, fontWeight: 700 }}>Lire l'article →</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
