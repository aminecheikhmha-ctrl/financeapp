// Supprime les console.log de debug en production
// Usage: npx ts-node scripts/cleanup.ts

import fs from "fs"
import path from "path"

const ROOT = path.join(__dirname, "..")
const DIRS = ["app", "lib", "components"]

function findFiles(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      out.push(...findFiles(full))
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const files = DIRS.flatMap(d => findFiles(path.join(ROOT, d)))
let cleaned = 0

for (const file of files) {
  const original = fs.readFileSync(file, "utf-8")
  // Remove debug console.log lines (preserves console.error and console.warn)
  const updated = original.replace(/^\s*console\.log\(.*\);\s*$/gm, "")
  if (updated !== original) {
    fs.writeFileSync(file, updated)
    cleaned++
    console.log(`✓ Cleaned: ${path.relative(ROOT, file)}`)
  }
}

console.log(`\n✅ Cleaned ${cleaned} files`)
