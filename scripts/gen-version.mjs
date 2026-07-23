// Stamps public/version.json with the git SHA at build/dev start.
// Read back after deploy: /version.json .sha must equal deployed HEAD.
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

function sh(cmd, fallback) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return fallback
  }
}

const sha = process.env.ZEABUR_GIT_COMMIT_SHA || sh('git rev-parse HEAD', 'unknown')
const builtAt = sh('git log -1 --format=%cI', new Date(0).toISOString())

mkdirSync('public', { recursive: true })
writeFileSync(
  'public/version.json',
  JSON.stringify({ sha, builtAt }, null, 2) + '\n',
)
console.log(`version.json → sha=${sha.slice(0, 12)}`)
