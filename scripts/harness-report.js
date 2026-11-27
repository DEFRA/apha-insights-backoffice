// Summarises the harness event log as a table of rules that fired. --detail adds the files and
// sessions for each rule, and names the configured rules that never fired. Events older than
// 90 days are ignored.
// Usage: npm run harness:report -- [--since 30d] [--detail]
// See docs/harness.md for how to read the report.

import { execFileSync } from 'node:child_process'
import { existsSync, globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { eventLogPath } from './harness-event-log.js'

const MAX_AGE_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000
const REPEATED_IN_SESSION = 3
const FIRES_OFTEN = 5
const FILES_SHOWN = 5

// Rules logged by the harness's own checks, rather than by ESLint, ShellCheck or SonarCloud
const HARNESS_RULES = new Set([
  'suppression-comment',
  'conventional-commits',
  'protected-config',
  'format',
  'lint'
])

// One file from each ESLint config block, so --print-config covers every active rule
const ESLINT_SAMPLE_PATTERNS = [
  'src/*.js',
  'src/client/**/*.js',
  'src/config/**/*.js',
  'src/constants/**/*.js',
  'test/**/*.test.js',
  'scripts/*.js'
]

const READINGS = `How to read this:
- Fires often, then fixed: the rule works. Consider a line in AGENTS.md so agents get it right first time
- Fires, then the agent says the rule is wrong: too strict or badly scoped. Tune it
- Same rule several times in one session: a guidance gap more than a missing rule
- Never fires: review it. Cheap and silent (keep) or slow and noisy (remove).
  Some rules never fire because the code complies and the rule keeps it that way`

function parseSince(value) {
  const days = Number(/^(\d+)d$/.exec(value)?.[1])
  if (!days) {
    throw new Error(`--since must look like 30d, got: ${value}`)
  }
  return Math.min(days, MAX_AGE_DAYS)
}

function readEvents(path, cutoff) {
  if (!existsSync(path)) {
    return []
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
    .filter((event) => Date.parse(event.ts) >= cutoff)
}

function countBy(values) {
  const counts = new Map()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts].sort(([, a], [, b]) => b - a)
}

function summarise(rule, events) {
  const sessions = countBy(events.map((event) => event.session).filter(Boolean))
  return {
    rule,
    fired: events.length,
    checks: [...new Set(events.map((event) => event.check))],
    sessions: sessions.length,
    maxInSession: sessions[0]?.[1] ?? 0,
    byPeople: events.filter((event) => event.actor === 'person').length,
    models: countBy(events.map((event) => event.model).filter(Boolean)),
    files: countBy(events.flatMap((event) => event.files ?? []))
  }
}

function hints(summary) {
  const result = []
  if (summary.maxInSession >= REPEATED_IN_SESSION) {
    result.push(
      `fired ${summary.maxInSession} times in one session: guidance gap?`
    )
  }
  if (summary.fired >= FIRES_OFTEN) {
    result.push('fires often: worth a line in AGENTS.md?')
  }
  return result
}

function formatCounts(counts, limit = counts.length) {
  const shown = counts.slice(0, limit).map(([name, n]) => `${name} (${n})`)
  const hidden = counts.length - shown.length
  return hidden > 0
    ? `${shown.join(', ')} and ${hidden} more`
    : shown.join(', ')
}

function plural(count, noun, nouns = `${noun}s`) {
  return `${count} ${count === 1 ? noun : nouns}`
}

function printSummary(summary, print) {
  print(`\n${summary.rule}: fired ${plural(summary.fired, 'time')}`)
  print(
    `  by: ${plural(summary.sessions, 'Claude Code session')}, ${plural(summary.byPeople, 'person', 'people')}`
  )
  print(`  checks: ${summary.checks.join(', ')}`)
  if (summary.files.length > 0) {
    print(`  files: ${formatCounts(summary.files, FILES_SHOWN)}`)
  }
  if (summary.models.length > 0) {
    print(`  models: ${formatCounts(summary.models)}`)
  }
  for (const hint of hints(summary)) {
    print(`  ! ${hint}`)
  }
}

function printTable(summaries, print) {
  const header = ['Rule', 'Fired', 'Model', 'Checked by']
  const rows = summaries.map((summary) => [
    summary.rule,
    String(summary.fired),
    summary.models.map(([model]) => model).join(', ') || '-',
    summary.checks.join(', ')
  ])
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column].length))
  )
  const formatRow = (row) =>
    row
      .map((cell, column) =>
        column === 1
          ? cell.padStart(widths[column])
          : cell.padEnd(widths[column])
      )
      .join('  ')
      .trimEnd()
  print(formatRow(header))
  print(formatRow(widths.map((width) => '-'.repeat(width))))
  for (const row of rows) {
    print(formatRow(row))
  }
}

function isActive(setting) {
  const severity = Array.isArray(setting) ? setting[0] : setting
  return severity !== 0 && severity !== 'off'
}

function eslintRules(cwd) {
  const rules = new Set()
  const eslint = join(cwd, 'node_modules', '.bin', 'eslint')
  const files = ESLINT_SAMPLE_PATTERNS.map(
    (pattern) => globSync(pattern, { cwd })[0]
  )
  for (const file of files.filter(Boolean)) {
    const config = JSON.parse(
      execFileSync(eslint, ['--print-config', file], { cwd })
    )
    for (const [rule, setting] of Object.entries(config.rules)) {
      if (isActive(setting)) {
        rules.add(rule)
      }
    }
  }
  return rules
}

function groupByPlugin(rules) {
  const groups = new Map()
  for (const rule of rules) {
    let plugin = rule.includes('/') ? rule.split('/')[0] : 'eslint'
    if (HARNESS_RULES.has(rule)) {
      plugin = 'harness'
    }
    groups.set(plugin, [...(groups.get(plugin) ?? []), rule])
  }
  return groups
}

function printNeverFired(firedRules, cwd, print) {
  const configured = [...eslintRules(cwd), ...HARNESS_RULES]
  const neverFired = configured
    .filter((rule) => !firedRules.has(rule))
    .sort((a, b) => a.localeCompare(b))
  print(
    `\nNever fired: ${neverFired.length} of ${configured.length} ESLint and harness rules`
  )
  for (const [plugin, rules] of groupByPlugin(neverFired)) {
    print(`  ${plugin} (${rules.length}): ${rules.join(', ')}`)
  }
  print(
    '  ShellCheck and SonarCloud rules are not listed. SonarCloud keeps its own history per rule'
  )
}

/**
 * Prints the report.
 * @param {string[]} args - command line arguments: --since <days>d and --detail
 * @param {{ cwd?: string, print?: (line: string) => void }} [options]
 */
export function harnessReport(
  args,
  { cwd = process.cwd(), print = console.log } = {}
) {
  const { values } = parseArgs({
    args,
    options: {
      since: { type: 'string', default: '30d' },
      detail: { type: 'boolean', default: false }
    }
  })
  const days = parseSince(values.since)
  const path = eventLogPath(cwd)
  const events = readEvents(path, Date.now() - days * DAY_MS)

  print(`Harness events in the last ${plural(days, 'day')}, from ${path}`)
  const byRule = Map.groupBy(events, (event) => event.rule)
  const summaries = [...byRule]
    .map(([rule, ruleEvents]) => summarise(rule, ruleEvents))
    .sort((a, b) => b.fired - a.fired)
  if (summaries.length === 0) {
    print('\nNo rules fired.')
  }

  if (!values.detail) {
    if (summaries.length > 0) {
      print('')
      printTable(summaries, print)
    }
    print('\nFor full details run with --detail')
    return
  }

  for (const summary of summaries) {
    printSummary(summary, print)
  }
  printNeverFired(new Set(byRule.keys()), cwd, print)
  print(`\n${READINGS}`)
}

if (import.meta.main) {
  try {
    harnessReport(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
