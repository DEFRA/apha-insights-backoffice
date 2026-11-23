// Locates the harness event log, which lives inside .git so it is never committed.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const LOG_PATH = 'claude-harness/events.jsonl'

// Same as `git rev-parse --git-dir`: in a worktree, .git is a file that points at its own git directory
function gitDir(directory) {
  const dotGit = join(directory, '.git')
  if (existsSync(dotGit)) {
    if (statSync(dotGit).isDirectory()) return dotGit
    const pointer = /^gitdir: (.+)$/m.exec(readFileSync(dotGit, 'utf8'))
    return pointer ? resolve(directory, pointer[1]) : dotGit
  }
  const parent = dirname(directory)
  return parent === directory ? undefined : gitDir(parent)
}

export function eventLogPath(directory = process.cwd()) {
  return join(process.env.GIT_DIR ?? gitDir(directory), LOG_PATH)
}
