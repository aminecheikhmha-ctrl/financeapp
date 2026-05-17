// Run: node scripts/generate-icons.mjs
// Generates icon-192.png and icon-512.png in /public/
// Requires: npm install canvas (dev only)

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, "../public")

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext("2d")
  const r = size * 0.15 // corner radius

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, "#080808")
  grad.addColorStop(1, "#111111")
  ctx.fillStyle = grad

  // Rounded rect
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fill()

  // Green glow circle
  const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.4)
  glow.addColorStop(0, "rgba(74,222,128,0.25)")
  glow.addColorStop(1, "rgba(74,222,128,0)")
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2)
  ctx.fill()

  // Inner rounded rect (green gradient)
  const pad = size * 0.2
  const innerR = size * 0.08
  const greenGrad = ctx.createLinearGradient(pad, pad, size - pad, size - pad)
  greenGrad.addColorStop(0, "#4ade80")
  greenGrad.addColorStop(1, "#059669")
  ctx.fillStyle = greenGrad
  const iSize = size - pad * 2

  ctx.beginPath()
  ctx.moveTo(pad + innerR, pad)
  ctx.lineTo(pad + iSize - innerR, pad)
  ctx.quadraticCurveTo(pad + iSize, pad, pad + iSize, pad + innerR)
  ctx.lineTo(pad + iSize, pad + iSize - innerR)
  ctx.quadraticCurveTo(pad + iSize, pad + iSize, pad + iSize - innerR, pad + iSize)
  ctx.lineTo(pad + innerR, pad + iSize)
  ctx.quadraticCurveTo(pad, pad + iSize, pad, pad + iSize - innerR)
  ctx.lineTo(pad, pad + innerR)
  ctx.quadraticCurveTo(pad, pad, pad + innerR, pad)
  ctx.closePath()
  ctx.fill()

  // Letter "F"
  ctx.fillStyle = "#000000"
  ctx.font = `900 ${size * 0.35}px Arial, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("F", size / 2, size / 2 + size * 0.02)

  return canvas.toBuffer("image/png")
}

try {
  writeFileSync(join(publicDir, "icon-192.png"), generateIcon(192))
  console.log("✓ icon-192.png generated")
  writeFileSync(join(publicDir, "icon-512.png"), generateIcon(512))
  console.log("✓ icon-512.png generated")
} catch (e) {
  console.error("Error: install canvas first → npm install --save-dev canvas")
  console.error(e.message)
}
