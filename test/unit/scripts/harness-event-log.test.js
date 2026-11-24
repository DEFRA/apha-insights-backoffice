import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { eventLogPath } from '#scripts/harness-event-log.js'

const LOG = 'claude-harness/events.jsonl'
let root

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'harness-')))
  vi.stubEnv('GIT_DIR', undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('eventLogPath', () => {
  test('finds .git in a parent directory', () => {
    mkdirSync(join(root, '.git'))
    mkdirSync(join(root, 'src'))

    expect(eventLogPath(join(root, 'src'))).toBe(join(root, '.git', LOG))
  })

  test('follows the .git file in a worktree', () => {
    writeFileSync(join(root, '.git'), 'gitdir: ../main/.git/worktrees/x\n')

    expect(eventLogPath(root)).toBe(join(root, '../main/.git/worktrees/x', LOG))
  })

  test('uses GIT_DIR when git sets it', () => {
    vi.stubEnv('GIT_DIR', '/repo/.git')

    expect(eventLogPath(root)).toBe(join('/repo/.git', LOG))
  })

  test('fails outside a git repository', () => {
    expect(() => eventLogPath('/')).toThrow('Not inside a git repository')
  })
})
