import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { harnessReport } from '#scripts/harness-report.js'

const { execFileSync } = vi.hoisted(() => ({ execFileSync: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync }))

const DAY_MS = 24 * 60 * 60 * 1000
let repo
let lines

function writeEvents(events) {
  mkdirSync(join(repo, '.git/claude-harness'), { recursive: true })
  writeFileSync(
    join(repo, '.git/claude-harness/events.jsonl'),
    [...events.map((event) => JSON.stringify(event)), 'not json'].join('\n')
  )
}

function report(args) {
  harnessReport(args, { cwd: repo, print: (line) => lines.push(line) })
  return lines.join('\n')
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'harness-'))
  mkdirSync(join(repo, '.git'))
  lines = []
  vi.stubEnv('GIT_DIR', join(repo, '.git'))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('harnessReport', () => {
  test('prints a table of the rules that fired by default', () => {
    const now = new Date().toISOString()
    writeEvents([
      ...Array.from({ length: 2 }, () => ({
        ts: now,
        rule: 'no-undef',
        check: 'lint-edited-file',
        session: 's1',
        model: 'm1',
        files: ['a.js']
      })),
      { ts: now, rule: 'format', check: 'pre-commit', actor: 'person' }
    ])

    const output = report([])

    expect(lines).toContain('Rule      Fired  Model  Checked by')
    expect(lines).toContain('no-undef      2  m1     lint-edited-file')
    expect(lines).toContain('format        1  -      pre-commit')
    expect(output).toContain('For full details run with --detail')
    expect(output).not.toContain('files:')
    expect(output).not.toContain('Never fired')
    expect(execFileSync).not.toHaveBeenCalled()
  })

  test('summarises each rule and lists harness rules that never fired', () => {
    const now = new Date().toISOString()
    const repeated = {
      ts: now,
      rule: 'no-unused-vars',
      check: 'lint-edited-file',
      session: 's1',
      model: 'm1'
    }
    writeEvents([
      ...Array.from({ length: 5 }, (_, i) => ({
        ...repeated,
        files: [`f${i}.js`, 'a.js']
      })),
      { ts: now, rule: 'format', check: 'pre-commit', actor: 'person' },
      { ts: new Date(Date.now() - 40 * DAY_MS).toISOString(), rule: 'lint' }
    ])

    const output = report(['--since', '30d', '--detail'])

    expect(output).toContain('Harness events in the last 30 days')
    expect(output).toContain('no-unused-vars: fired 5 times')
    expect(output).toContain('by: 1 Claude Code session, 0 people')
    expect(output).toContain('files: a.js (5), f0.js (1)')
    expect(output).toContain('and 1 more')
    expect(output).toContain('models: m1 (5)')
    expect(output).toContain('fired 5 times in one session: guidance gap?')
    expect(output).toContain('fires often: worth a line in AGENTS.md?')
    expect(output).toContain('format: fired 1 time')
    expect(output).toContain('0 Claude Code sessions, 1 person')
    expect(output).toContain(
      'harness (4): conventional-commits, lint, protected-config, suppression-comment'
    )
  })

  test('counts active ESLint rules among those that never fired', () => {
    mkdirSync(join(repo, 'src'))
    writeFileSync(join(repo, 'src/index.js'), '')
    execFileSync.mockReturnValue(
      JSON.stringify({
        rules: {
          'sonarjs/no-identical-functions': 2,
          'sonarjs/todo-tag': [0],
          eqeqeq: ['error'],
          'no-console': 'off'
        }
      })
    )

    const output = report(['--detail'])

    expect(execFileSync).toHaveBeenCalledWith(
      join(repo, 'node_modules/.bin/eslint'),
      ['--print-config', 'src/index.js'],
      { cwd: repo }
    )
    expect(output).toContain('No rules fired.')
    expect(output).toContain('Never fired: 7 of 7 ESLint and harness rules')
    expect(output).toContain('sonarjs (1): sonarjs/no-identical-functions')
    expect(output).toContain('eslint (1): eqeqeq')
    expect(output).toContain('harness (5): conventional-commits, format, lint')
    expect(output).not.toContain('For full details')
  })

  test('caps the period at 90 days and rejects a malformed one', () => {
    expect(report(['--since', '365d'])).toContain('last 90 days')
    expect(() => report(['--since', 'month'])).toThrow(
      '--since must look like 30d'
    )
  })
})
