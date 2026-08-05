// tokens.css is the shared design contract (MASTER-PLAN §A) and is
// checksum-guarded. This asserts the live file still matches the recorded
// sha256; any intended token change must update tokens.css.sha256 in the
// SAME commit (law-9-style discipline).
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const css = readFileSync('src/ui/tokens.css')
const recorded = readFileSync('src/ui/tokens.css.sha256', 'utf8').trim()
const live = createHash('sha256').update(css).digest('hex')

if (live !== recorded) {
  console.error('✗ tokens.css checksum drift:')
  console.error(`  recorded ${recorded}`)
  console.error(`  live     ${live}`)
  console.error('  If intentional, update src/ui/tokens.css.sha256 in the same commit.')
  process.exit(1)
}
console.log('✓ tokens.css matches recorded checksum')
