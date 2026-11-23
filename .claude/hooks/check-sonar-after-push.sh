#!/usr/bin/env bash
# Runs in the background after a git push. Waits for SonarCloud to analyse the pull request
# for the pushed commit, then exit code 2 wakes Claude with the failures if the quality gate fails.
# Uses SonarCloud's public API, so it needs no token while the project is public.
# A failed gate is recorded in the harness event log, see docs/harness.md.

input=$(cat)
[[ "$input" == *"git push"* ]] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
project=$(sed -n 's/^sonar.projectKey=//p' sonar-project.properties 2>/dev/null)
[[ -n "$project" ]] || exit 0
pr=$(gh pr view --json number --jq .number 2>/dev/null) || exit 0
sha=$(git rev-parse HEAD)
api=https://sonarcloud.io/api

# Prints the quality gate status once SonarCloud has analysed this commit, otherwise nothing
gate_for_commit() {
  curl -fsS "$api/project_pull_requests/list?project=$project" 2>/dev/null | node -e '
    let s = ""
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const [pr, sha] = process.argv.slice(1)
      const match = JSON.parse(s).pullRequests.find((p) => p.key === pr && p.commit?.sha === sha)
      if (match) process.stdout.write(match.status.qualityGateStatus)
    })' "$pr" "$sha"
}

gate=""
for _ in $(seq 1 40); do
  gate=$(gate_for_commit)
  [[ -n "$gate" ]] && break
  sleep 15
done

# No analysis within 10 minutes, or the gate passed: nothing to report. CI still shows the result.
[[ -z "$gate" || "$gate" == "OK" ]] && exit 0

gate_json=$(curl -fsS "$api/qualitygates/project_status?projectKey=$project&pullRequest=$pr" 2>/dev/null)
conditions=$(printf '%s' "$gate_json" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    for (const c of JSON.parse(s).projectStatus.conditions.filter((c) => c.status === "ERROR")) {
      console.log("- " + c.metricKey + ": " + c.actualValue + " (threshold " + c.errorThreshold + ")")
    }
  })')

issues_json=$(curl -fsS "$api/issues/search?componentKeys=$project&pullRequest=$pr&resolved=false&ps=50" 2>/dev/null)
issues=$(printf '%s' "$issues_json" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    for (const i of JSON.parse(s).issues) {
      console.log("- " + i.component.split(":").pop() + ":" + (i.line ?? "") + " [" + i.rule + "] " + i.message)
    }
  })')

node scripts/log-harness-event.js --layer claude-hook --check sonar-quality-gate --outcome rejected \
  --sonar-gate-report <(printf '%s' "$gate_json") --sonar-report <(printf '%s' "$issues_json") <<< "$input" 2>/dev/null

{
  echo "SonarCloud quality gate failed for PR #$pr at commit ${sha:0:7}. Fix these and push again."
  echo "Failing conditions:"
  echo "${conditions:-- none listed}"
  echo "Open issues:"
  echo "${issues:-- none listed}"
  echo "Details: https://sonarcloud.io/dashboard?id=$project&pullRequest=$pr"
} >&2
exit 2
