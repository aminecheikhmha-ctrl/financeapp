import { createCanvas } from "canvas"
import { writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "../public/og-image.png")

const W = 1200
const H = 630

const canvas = createCanvas(W, H)
const ctx = canvas.getContext("2d")

// Background
ctx.fillStyle = "#080808"
ctx.fillRect(0, 0, W, H)

// Subtle grid dots
ctx.fillStyle = "rgba(255,255,255,0.04)"
for (let x = 40; x < W; x += 40) {
  for (let y = 40; y < H; y += 40) {
    ctx.beginPath()
    ctx.arc(x, y, 1, 0, Math.PI * 2)
    ctx.fill()
  }
}

// Green glow top-left
const glow = ctx.createRadialGradient(200, 150, 0, 200, 150, 400)
glow.addColorStop(0, "rgba(74,222,128,0.15)")
glow.addColorStop(1, "transparent")
ctx.fillStyle = glow
ctx.fillRect(0, 0, W, H)

// Logo badge
const cx = 140, cy = 120
ctx.fillStyle = "#4ade80"
roundRect(ctx, cx - 36, cy - 36, 72, 72, 18)
ctx.fill()
ctx.fillStyle = "#000"
ctx.font = "bold 40px sans-serif"
ctx.textAlign = "center"
ctx.textBaseline = "middle"
ctx.fillText("F", cx, cy + 2)

// App name
ctx.fillStyle = "#ffffff"
ctx.font = "bold 52px sans-serif"
ctx.textAlign = "left"
ctx.textBaseline = "alphabetic"
ctx.fillText("FinanceApp", 212, 136)

// Tagline
ctx.fillStyle = "#4ade80"
ctx.font = "500 28px sans-serif"
ctx.fillText("Trading intelligent avec l'IA", 140, 210)

// Divider
ctx.strokeStyle = "rgba(255,255,255,0.08)"
ctx.lineWidth = 1
ctx.beginPath()
ctx.moveTo(140, 250)
ctx.lineTo(W - 140, 250)
ctx.stroke()

// Feature pills
const features = ["📡 Signaux temps réel", "🧠 Analyses IA", "📚 Académie trading", "💬 Communauté"]
let fx = 140
ctx.font = "500 22px sans-serif"
for (const feat of features) {
  const tw = ctx.measureText(feat).width
  const pw = tw + 32
  ctx.fillStyle = "rgba(74,222,128,0.12)"
  roundRect(ctx, fx, 280, pw, 52, 12)
  ctx.fill()
  ctx.strokeStyle = "rgba(74,222,128,0.25)"
  ctx.lineWidth = 1
  roundRect(ctx, fx, 280, pw, 52, 12)
  ctx.stroke()
  ctx.fillStyle = "#e5e7eb"
  ctx.fillText(feat, fx + 16, 280 + 33)
  fx += pw + 16
}

// Big headline
ctx.fillStyle = "#ffffff"
ctx.font = "bold 68px sans-serif"
ctx.textAlign = "center"
ctx.fillText("Tradez plus intelligemment.", W / 2, 430)

// Sub
ctx.fillStyle = "rgba(255,255,255,0.5)"
ctx.font = "400 30px sans-serif"
ctx.fillText("Signaux, graphes pro, IA et académie — tout en un.", W / 2, 490)

// URL badge
ctx.fillStyle = "rgba(255,255,255,0.06)"
roundRect(ctx, W / 2 - 160, 540, 320, 48, 24)
ctx.fill()
ctx.fillStyle = "#4ade80"
ctx.font = "600 22px sans-serif"
ctx.fillText("financeapp-kappa-six.vercel.app", W / 2, 570)

const buf = canvas.toBuffer("image/png")
writeFileSync(OUT, buf)
console.log(`✓ og-image.png generated (${W}×${H})`)

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
