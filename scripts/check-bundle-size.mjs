// First-load JS budget gate (§C: speed is a feature). Fails the build if the
// gzipped JS the entry HTML pulls exceeds the budget. Enforced in CI.
import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const BUDGET_KB = 200
const dir = 'dist/assets'

let files
try {
  files = readdirSync(dir).filter((f) => f.endsWith('.js'))
} catch {
  console.error('check-bundle-size: no dist/assets — build first')
  process.exit(1)
}

// First-load = entry + its static imports. Vite hashes them all into assets/;
// we sum every emitted .js as the conservative ceiling (no lazy routes yet).
let totalGz = 0
for (const f of files) {
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
