import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { logHarnessEvent } from '#scripts/log-harness-event.js'

let repo

function write(name, content) {
  const path = join(repo, name)
  writeFileSync(path, content)
  return path
}

function loggedEvents() {
  return readFileSync(join(repo, '.git/claude-harness/events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'harness-'))
  mkdirSync(join(repo, '.git'))
  vi.stubEnv('CI', '')
  vi.stubEnv('HARNESS_LOG', '')
  vi.stubEnv('GIT_DIR', undefined)
  vi.stubEnv('CLAUDECODE', '')
  vi.stubEnv('CLAUDE_CODE_SESSION_ID', '')
  vi.stubEnv('CLAUDE_CONFIG_DIR', repo)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('logHarnessEvent', () => {
  test('records one event per rule from each report, with the session and model', () => {
    const transcript = write(
      'transcript.jsonl',
      '{"message":{"model":"claude-a"}}\n{"message":{"model":"claude-b"}}\n'
    )
    const reports = {
      eslint: [
        {
          filePath: join(repo, 'src/a.js'),
          messages: [
            { ruleId: 'no-unused-vars', severity: 2 },
            { ruleId: 'sonarjs/todo-tag', severity: 1 },
            { ruleId: null, severity: 2 }
          ]
        }
      ],
      shellcheck: { comments: [{ code: 2086, file: 'a.sh' }] },
      sonar: { issues: [{ rule: 'shell:S131', component: 'key:b.sh' }] },
      gate: {
        projectStatus: {
          conditions: [
            { status: 'ERROR', metricKey: 'new_coverage' },
            { status: 'OK', metricKey: 'new_bugs' }
          ]
        }
      }
    }
    const args = [
      '--layer=claude-hook',
      '--check=lint',
      '--outcome=blocked',
      `--eslint-report=${write('eslint.json', JSON.stringify(reports.eslint))}`,
      `--shellcheck-report=${write('sc.json', JSON.stringify(reports.shellcheck))}`,
      `--sonar-report=${write('sonar.json', JSON.stringify(reports.sonar))}`,
      `--sonar-gate-report=${write('gate.json', JSON.stringify(reports.gate))}`,
      `--suppressions-report=${write('supp.txt', 'c.js:3:  // the matched comment\n')}`
    ]
    const payload = JSON.stringify({
      session_id: 's1',
      transcript_path: transcript,
      tool_name: 'Edit'
    })

    logHarnessEvent(args, payload, repo)

    expect(loggedEvents()).toEqual([
      expect.objectContaining({
        layer: 'claude-hook',
        check: 'lint',
        outcome: 'blocked',
        actor: 'claude-code',
        session: 's1',
        model: 'claude-b',
        tool: 'Edit',
        rule: 'no-unused-vars',
        files: ['src/a.js']
      }),
      expect.objectContaining({ rule: 'eslint/parse-error' }),
      expect.objectContaining({ rule: 'SC2086', files: ['a.sh'] }),
      expect.objectContaining({ rule: 'shell:S131', files: ['b.sh'] }),
      expect.objectContaining({ rule: 'gate:new_coverage' }),
      expect.objectContaining({
        rule: 'suppression-comment',
        files: ['c.js'],
        detail: '// the matched comment'
      })
    ])
  })

  test('takes the rule from an auto mode reason and finds the transcript by session', () => {
    mkdirSync(join(repo, 'projects/repo'), { recursive: true })
    write('projects/repo/s2.jsonl', '{"message":{"model":"claude-c"}}\n')
    vi.stubEnv('CLAUDE_CODE_SESSION_ID', 's2')

    logHarnessEvent(
      ['--layer=claude-deny', '--rule-from-reason'],
      JSON.stringify({ reason: '[Self-Modification] edits hooks' }),
      repo
    )

    expect(loggedEvents()[0]).toMatchObject({
      session: 's2',
      model: 'claude-c',
      rule: 'Self-Modification',
      detail: '[Self-Modification] edits hooks'
    })
  })

  test('names the rule after the check when nothing else does, and logs people as people', () => {
    logHarnessEvent(
      ['--check=pre-commit', '--detail=x', '--eslint-report=missing.json'],
      '',
      repo
    )
    logHarnessEvent(
      ['--rule=format', '--file=a.js', '--rule-from-reason'],
      '',
      repo
    )

    const [fallback, format, reason] = loggedEvents()
    expect(fallback).toMatchObject({
      rule: 'pre-commit',
      detail: 'x',
      actor: 'person'
    })
    expect(fallback).not.toHaveProperty('model')
    expect(format).toMatchObject({ rule: 'format', files: ['a.js'] })
    expect(reason).toMatchObject({ rule: 'auto-mode-denied' })
  })

  test('logs nothing in CI', () => {
    vi.stubEnv('CI', 'true')

    logHarnessEvent(['--rule=format'], '', repo)

    expect(() => loggedEvents()).toThrow()
  })
})
