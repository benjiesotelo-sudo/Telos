// Installs the repo's committed git hooks into .git/hooks (R15). Runs via npm "prepare"
// on every npm install; silently a no-op outside a git checkout (e.g. tarball installs).
import { execFileSync } from 'node:child_process'
import { copyFileSync, chmodSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let hooksDir
try {
  const out = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  hooksDir = resolve(root, out.trim())
} catch {
  process.exit(0) // no git or not a repo - nothing to install
}

mkdirSync(hooksDir, { recursive: true })
const target = join(hooksDir, 'pre-commit')
copyFileSync(join(root, 'scripts', 'git-hooks', 'pre-commit'), target)
chmodSync(target, 0o755)
console.log('git hooks: installed pre-commit guard (owner personal-doc paths)')
