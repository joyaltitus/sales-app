// First-load JS budget gate (§C: speed is a feature). Fails the build if the
// gzipped JS the entry HTML pulls exceeds the budget. Enforced in CI.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const BUDGET_KB = 200
const dir = 'dist/assets'

let html
try {
  html = readFileSync('dist/index.html', 'utf8')
} catch {
  console.error('check-bundle-size: no dist/index.html — build first')
  process.exit(1)
}

// First-load = the module entry plus any modulepreload chunks Vite places in
// index.html. Lazy routes/sheets are deliberately excluded: they are fetched
// only after navigation or an explicit user action.
const files = [...html.matchAll(/(?:src|href)="\/?assets\/([^"]+\.js)"/g)].map((match) => match[1])
if (files.length === 0) {
  console.error('check-bundle-size: no first-load JavaScript found in dist/index.html')
  process.exit(1)
}

let totalGz = 0
for (const f of new Set(files)) {
  const gz = gzipSync(readFileSync(join(dir, f))).length
  totalGz += gz
}

const totalKb = totalGz / 1024
const line = `first-load JS: ${totalKb.toFixed(1)} KB gz (budget ${BUDGET_KB} KB)`
if (totalKb > BUDGET_KB) {
  console.error(`✗ ${line} — OVER BUDGET`)
  process.exit(1)
}
console.log(`✓ ${line}`)
