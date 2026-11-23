// Records a harness event (a hook block, rejection or revert) in a JSON Lines file inside .git,
// one line per rule that fired. Reads the Claude Code hook payload from stdin when there is one,
// so callers without a payload must redirect stdin from /dev/null.
// Logging must never break a hook, so every failure is ignored and nothing is printed.
// See docs/harness.md for the fields and how to read the log.

import {
  appendFileSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { parseArgs } from 'node:util'

import { eventLogPath } from './harness-event-log.js'

const TRANSCRIPT_TAIL_BYTES = 256 * 1024
const DETAIL_MAX_LENGTH = 200

const options = {
  layer: { type: 'string' },
  check: { type: 'string' },
  outcome: { type: 'string' },
  rule: { type: 'string', multiple: true, default: [] },
  file: { type: 'string', multiple: true, default: [] },
  detail: { type: 'string' },
  'rule-from-reason': { type: 'boolean', default: false },
  'eslint-report': { type: 'string' },
  'shellcheck-report': { type: 'string' },
  'sonar-report': { type: 'string' },
  'sonar-gate-report': { type: 'string' },
  'suppressions-report': { type: 'string' }
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function readPayload() {
  if (process.stdin.isTTY) return {}
  return parseJson(readText(0)) ?? {}
}

function toRepoPath(file) {
  return isAbsolute(file) ? relative(process.cwd(), file) : file
}

function truncate(text) {
  return text.length > DETAIL_MAX_LENGTH
    ? `${text.slice(0, DETAIL_MAX_LENGTH)}…`
    : text
}

function eslintFindings(report) {
  return (report ?? []).flatMap((result) =>
    result.messages
      .filter((message) => message.severity === 2)
      .map((message) => ({
        rule: message.ruleId ?? 'eslint/parse-error',
        file: result.filePath
      }))
  )
}

function shellcheckFindings(report) {
  return (report?.comments ?? []).map((comment) => ({
    rule: `SC${comment.code}`,
    file: comment.file
  }))
}

function sonarFindings(report) {
  return (report?.issues ?? []).map((issue) => ({
    rule: issue.rule,
    file: issue.component.split(':').pop()
  }))
}

function sonarGateFindings(report) {
  return (report?.projectStatus?.conditions ?? [])
    .filter((condition) => condition.status === 'ERROR')
    .map((condition) => ({ rule: `gate:${condition.metricKey}` }))
}

// check-suppressions.sh prints matches as file:line:text. The text shows which rule was switched off
function suppressionFindings(text) {
  return text
    .split('\n')
    .map((line) => /^(.+?):\d+:(.*)$/.exec(line))
    .filter(Boolean)
    .map(([, file, code]) => ({
      rule: 'suppression-comment',
      file,
      detail: truncate(code.trim())
    }))
}

function reasonFinding(reason = '') {
  const category = /^\[([^\]]+)\]/.exec(reason)?.[1]
  return { rule: category ?? 'auto-mode-denied', detail: truncate(reason) }
}

function collectFindings(values, payload) {
  const reports = [
    [values['eslint-report'], (text) => eslintFindings(parseJson(text))],
    [
      values['shellcheck-report'],
      (text) => shellcheckFindings(parseJson(text))
    ],
    [values['sonar-report'], (text) => sonarFindings(parseJson(text))],
    [values['sonar-gate-report'], (text) => sonarGateFindings(parseJson(text))],
    [values['suppressions-report'], suppressionFindings]
  ]
  const findings = reports
    .filter(([path]) => path)
    .flatMap(([path, parse]) => parse(readText(path)))

  for (const rule of values.rule) {
    findings.push(...values.file.map((file) => ({ rule, file })), { rule })
  }
  if (values['rule-from-reason']) findings.push(reasonFinding(payload.reason))

  // Every event names a rule, even when a report could not be read
  return findings.length > 0 ? findings : [{ rule: values.check }]
}

function groupByRule(findings) {
  const rules = new Map()
  for (const { rule, file, detail } of findings) {
    const entry = rules.get(rule) ?? { files: new Set(), details: new Set() }
    if (file) entry.files.add(toRepoPath(file))
    if (detail) entry.details.add(detail)
    rules.set(rule, entry)
  }
  return rules
}

function findTranscript(session) {
  const projects = join(
    process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'),
    'projects'
  )
  return readdirSync(projects)
    .map((project) => join(projects, project, `${session}.jsonl`))
    .find((path) => existsSync(path))
}

// The model is not in every hook payload, so take the last one the transcript recorded
function modelFromTranscript(path) {
  const fd = openSync(path, 'r')
  try {
    const size = fstatSync(fd).size
    const length = Math.min(size, TRANSCRIPT_TAIL_BYTES)
    const buffer = Buffer.alloc(length)
    readSync(fd, buffer, 0, length, size - length)
    const models = [
      ...buffer.toString('utf8').matchAll(/"model":"([^"<]+)"/g)
    ].map(([, model]) => model)
    return models.at(-1)
  } finally {
    closeSync(fd)
  }
}

function findModel(payload, session) {
  try {
    const transcript =
      payload.transcript_path ?? (session && findTranscript(session))
    return transcript ? modelFromTranscript(transcript) : undefined
  } catch {
    return undefined
  }
}

function buildEvents(values, payload) {
  const session = payload.session_id ?? process.env.CLAUDE_CODE_SESSION_ID
  const common = {
    ts: new Date().toISOString(),
    layer: values.layer,
    check: values.check,
    outcome: values.outcome,
    actor: session || process.env.CLAUDECODE === '1' ? 'claude-code' : 'person',
    session,
    model: findModel(payload, session),
    tool: payload.tool_name
  }
  return [...groupByRule(collectFindings(values, payload))].map(
    ([rule, { files, details }]) => ({
      ...common,
      rule,
      files: files.size > 0 ? [...files] : undefined,
      detail: values.detail ?? ([...details].join(' | ') || undefined)
    })
  )
}

function main() {
  if (process.env.CI || process.env.HARNESS_LOG === '0') return
  const { values } = parseArgs({ options, strict: false })
  const payload = readPayload()
  const lines = buildEvents(values, payload).map((event) =>
    JSON.stringify(event)
  )
  const path = eventLogPath()
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, lines.map((line) => `${line}\n`).join(''))
}

try {
  main()
} catch {
  // A failed log write must never change what the hook does
}
