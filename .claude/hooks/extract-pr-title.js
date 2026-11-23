// Reads a Claude Code hook payload from stdin and prints the --title of a
// `gh pr create` or `gh pr edit` command, or nothing if there is none.

const GH_PR_COMMAND = /\bgh\s+pr\s+(create|edit)\b/
const TITLE_FLAG =
  /(?:^|\s)(?:--title|-t)(?:=|\s+)(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))/

let input = ''
process.stdin.on('data', (chunk) => {
  input += chunk
})
process.stdin.on('end', () => {
  const command = JSON.parse(input).tool_input?.command ?? ''
  if (!GH_PR_COMMAND.test(command)) return

  const match = command.match(TITLE_FLAG)
  if (!match) return

  const [, doubleQuoted, singleQuoted, bare] = match
  process.stdout.write(
    doubleQuoted?.replaceAll(/\\(.)/g, '$1') ?? singleQuoted ?? bare
  )
})
