import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// R15: the pre-commit guard that keeps Benjie's personal docs out of git history (two prior
// incidents of fixers sweeping his untracked files into commits). The hook lives in the repo at
// scripts/git-hooks/pre-commit and scripts/install-git-hooks.mjs (npm "prepare") installs it.
// Self-test in a THROWAWAY temp repo - never stages anything in the real working tree.

const repoRoot = resolve(__dirname, '..')

const hasGit = (() => {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); return true } catch { return false }
})()

let repo = ''
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const commit = (msg: string, ...extra: string[]) => git('commit', '-m', msg, ...extra)
const stage = (rel: string, content = 'x') => {
  mkdirSync(join(repo, rel, '..'), { recursive: true })
  writeFileSync(join(repo, rel), content)
  git('add', rel)
}

describe.skipIf(!hasGit)('pre-commit guard (owner personal-doc paths)', () => {
  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'telos-hook-'))
    git('init')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Hook Test')
    // Mimic a fresh clone: the two committed files, then the installer exactly as npm prepare runs it.
    cpSync(join(repoRoot, 'scripts', 'git-hooks'), join(repo, 'scripts', 'git-hooks'), { recursive: true })
    cpSync(join(repoRoot, 'scripts', 'install-git-hooks.mjs'), join(repo, 'scripts', 'install-git-hooks.mjs'))
    execFileSync(process.execPath, [join('scripts', 'install-git-hooks.mjs')], { cwd: repo, stdio: 'ignore' })
    expect(existsSync(join(repo, '.git', 'hooks', 'pre-commit'))).toBe(true)
    git('add', 'scripts')
    commit('init') // gives HEAD a target so `git restore --staged` works below
  })
  afterAll(() => { if (repo) rmSync(repo, { recursive: true, force: true }) })

  it('blocks every owner personal-doc pattern, naming the path and the override', () => {
    const blocked = [
      'docs/Telos-Statistical-Audit-Report.pdf',
      'docs/Telos-Methodologies-Covered.txt',
      'docs/testing/wage1.csv',
      'docs/paper/paper.pdf',
      'docs/superpowers/plans/2026-06-15-telos-econometrics-timeseries.md',
    'docs/superpowers/specs/2026-06-15-telos-econometrics-timeseries-design.md',
      'docs/superpowers/reviews/2026-06-15-econometrics-spike.md',
      'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/canvas-render-building.png',
    ]
    for (const rel of blocked) {
      stage(rel)
      let err = ''
      try { commit(`add ${rel}`); expect.fail(`commit of ${rel} should have been blocked`) }
      catch (e) { err = String((e as { stderr?: string }).stderr ?? e) }
      expect(err).toContain(rel)
      expect(err).toContain('--no-verify')
      git('restore', '--staged', rel)
    }
  })

  it('lets normal files through, including docs/paper/paper.md', () => {
    stage('src/normal.ts')
    stage('docs/paper/paper.md', '# paper')
    commit('normal files')
    expect(git('log', '--oneline')).toContain('normal files')
  })

  it('git commit --no-verify overrides the guard', () => {
    stage('docs/Telos-override.txt')
    commit('owner-sanctioned override', '--no-verify')
    expect(git('log', '--oneline')).toContain('owner-sanctioned override')
  })
})
