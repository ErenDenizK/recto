---
name: hq-report
description: Writes the Recto HQ issue (#26) at the end of a cycle, as the live-state body and one report comment, by the charter's rules (English, short, PR links, spend by tier, board questions with a recommendation and a default). Use when a cycle, heartbeat or merge pass ends, and for the morning, evening, daily and weekly reports.
---

# HQ report

HQ is the company's memory (charter "Memory", "Context hygiene" 5): what is not in the body or the
repo when the cycle ends is lost. The owner reads it in the GitHub app on a phone, so it is short,
plain and in English (PRC-27); the chat with the owner stays in Turkish.

## The body (rewrite, do not append)

Under 6 KB, in this order: `Lock:` (cleared at the end), `Live:` (deployed commit), `Queue:` (in
merge order, `merge-queue`), `Lanes:` (branch, role, expected end), `Next:` (at most ten),
`Parked:` (each with its diagnosis), `Board:` (open questions). Drop anything finished; history
lives in comments and PRs.

## The comment

Two to ten lines for a cycle; the daily report may run longer but keeps the order:

1. **Shipped:** each merged PR as `#n` with one line on what a user sees, and the deploy commit if
   one went out (its run result checked, PRC-31).
2. **Open:** the queue, running lanes, anything parked and why.
3. **Spend:** agent tokens by tier (builds, judges and research, reads) against the cycle's budget.
4. **Decisions:** row ids taken this cycle (`decision-rows`); a taste call carries before and after
   screenshots.
5. **Board:** at most three questions, each with the CEO's recommendation and the default that
   applies until answered. A question already asked is not asked again; point at it.

## Rules

- Claims carry their evidence: a PR link, a commit, a check result. "Green" means every check on
  that head, not the unit job.
- No logs, stack traces or tool output in HQ; one line of cause is enough, the detail is in the PR.
- No secrets, no email address, no internal session links beyond the brief artifact.
- Lead with what changed for the user; name process work in one line at the end.
- The 18:53 cycle's report ends with a push notification; a heartbeat with nothing done writes
  nothing.
