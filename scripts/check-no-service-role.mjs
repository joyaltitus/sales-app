// Law 8 tripwire: the browser bundle must NEVER hold service-role material.
// Greps every browser source root for forbidden markers. Wired into CI from day 1.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FORBIDDEN = [
  'service_role',
  'service-role',
  'serviceRole',
  'SUPABASE_SERVICE',
  'SERVICE_ROLE_KEY',
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx|js|jsx|css|html|json)$/.test(name)) out.push(p)
  }
  return out
}

const hits = []
for (const root of ['src', 'extension']) {
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8')
    for (const marker of FORBIDDEN) {
      if (text.includes(marker)) hits.push(`${file}: "${marker}"`)
    }
  }
}

if (hits.length) {
  console.error('✗ service-role marker found in client source (law 8):')
  for (const h of hits) console.error('  ' + h)
  process.exit(1)
}
console.log('✓ no service-role markers in src/ or extension/')
