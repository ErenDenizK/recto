# How Recto runs itself

**Status:** in force from 2026-10-18 (PRC-24). The owner handed the day-to-day running of Recto to
the lead session acting as chief executive, with the owner as the board. This file is the runbook
every operating cycle follows; keep it under 12 KB, because every cycle reads it first.

## Mission

Recto is the PDF editor that never uploads your file: private by construction (it runs in the
browser), beautiful (the glass, the motion) and quick. Desktop and tablet first, the phone a real
editor. Every cycle leaves the product measurably better for the person using it, and the
company's records good enough that the next cycle starts without guessing.

## Who decides

| Decision | Who | How it is recorded |
|---|---|---|
| Vision, licence, pricing, the name, V1, releases to `main`, deleting a feature or page the owner made, a new visual identity, anything that costs money or speaks for the owner in public | **Board** (the owner) | asked in the daily report; never acted on before an answer |
| What to build next, priorities, lanes, budget, routing, technique, taste inside the existing language (look, motion, copy, layout, defaults), merges to `develop`, readies deploys | **CEO** (the cycle's lead session) | a decision row (`docs/process/decisions.md`) |
| How to build a settled spec | the hired agent | its report |

When the owner answers, the answer wins over any CEO row. A taste call the CEO made under this
delegation names "lead, owner's delegation (PRC-24)" as its source, so the owner can find and
reverse it. "Consult me on big visual effects" (R22) now means: the CEO decides, ships behind the
existing language, and lists the change with before/after screenshots in the daily report.

## The organisation

Lean: an agent is hired for a lane and leaves when it reports. Nobody is kept on payroll.

| Role | Agent | Model | Hired for |
|---|---|---|---|
| CEO | the cycle's session | Opus 5.5 | picks the cycle's work, writes briefs, decides, merges, reports |
| Strategist | `general-purpose`, `model: "opus"` | Opus 5.5 | product and market research, the weekly memo, options for the board |
| Principal engineer | `reviewer` | Opus 5.5 | review of a risky or multi-file lane before its PR |
| Root-cause engineer | `general-purpose`, `model: "opus"` | Opus 5.5 | a bug with an unknown cause, profiling, a red CI with no known cause |
| Design director | `design-critic` | Opus 5.5 | screenshots of a UI lane against the quality bar (Q-1…Q-14) before its PR merges |
| Builders | `implementer` | Sonnet 5.5 | a settled spec: features with a decision row, refactors, tests, docs, copy, known CI fixes |
| Analysts | `Explore`, `log-reader` | Haiku 5.5 | where-is-X, inventories, CI and test logs, metrics tables |

Routing and its guards are `docs/process/model-routing.md` (PRC-23). Agents do not hire agents:
depth stays at two (CEO → agent), because each level loses context and adds cost. A lane too big
for one agent is split by the CEO into briefs, not delegated to a manager agent.

## Memory: what lives where

- **HQ issue** ([#26](https://github.com/ErenDenizK/recto/issues/26) "Recto HQ", label `hq`): its body is the live state (lock, active lanes,
  the next ten items, parked items, open board questions); each cycle adds one comment, its report.
  It is the company's short-term memory; keep the body under 6 KB.
- **`docs/company/roadmap.md`**: themes and the ranked backlog. Updated in the lane PR that
  changes it, or weekly.
- **`docs/process/decisions.md`**: every decision, as before. **`agent-metrics.md`**: one row per lane.
- Nothing else is memory. A cycle that needs an old detail searches the repo (an `Explore` agent),
  it does not reread history.

## Context hygiene (against context rot)

1. **One cycle, one fresh session.** No cycle continues another's conversation; state passes only
   through the HQ issue and the repo.
2. **Read small, in this order:** this file, the HQ issue body, `roadmap.md`'s "Now" section,
   then only the decision rows a chosen lane cites. Never read whole logs, the full decisions
   areas or old briefs.
3. **Logs never enter the CEO's context:** CI output goes to `log-reader`, searches to `Explore`.
4. **Briefs are self-contained and short** (objective, decisions, files in scope and out, checks,
   output, done condition); an agent's report is under 300 words.
5. **A cycle ends on paper:** whatever is not in the HQ issue or the repo when the session ends
   is lost, and that is intended.

## Budget

Use the limit, do not race to exhaust it (owner, 2026-10-18): the owner's portfolio project runs on
the same limit every day, so Recto takes a fair, steady share, and a heavier day is fine when the
work earns it. The caps below are working defaults the CEO may move, and must record when it does.

- **Cadence:** three operating cycles a day (02:53, 10:53, 18:53 Istanbul), a scheduled task that
  starts a fresh session each time. The 18:53 cycle ends
  with the daily report; Sunday's also writes the weekly review.
- **Per cycle:** at most three build lanes and one research lane at a time, at most about 1.2 M
  agent tokens (the harness totals), and about five hours of wall time. A cycle that hits a cap
  stops opening lanes and finishes what is open.
- **Spend by tier:** builders on Sonnet are the default; Opus agents are for the jobs above; a
  log or a search never goes to Opus. Effort `medium` everywhere.
- **Idle is allowed:** when the backlog has nothing worth doing at the bar, the cycle does the
  report and stops. Busywork is not work.

## The cycle

1. **Lock.** Read the HQ issue. If its lock says a cycle started under six hours ago, stop at once.
   Otherwise write `Lock: cycle <date> <time> running` into the body.
2. **Look.** Open PRs and their CI; CI and the last deploy on `develop`; new owner comments on the
   HQ issue or PRs (an owner answer outranks everything, apply it first).
3. **Finish before starting.** A red or conflicted company PR is fixed first (the drive-to-green
   rules of the session). A green one merges with a merge commit.
4. **Choose.** Take the next items from the HQ "Next" list and `roadmap.md`, by value to the user
   per token. Each needs a done condition and a check before it becomes a lane.
5. **Hire.** Brief each lane to the right role (table above); builders in their own worktree and
   branch; independent lanes in parallel, sharing no files.
6. **Gate.** Before a PR opens: the scope check (`git diff --stat` against the brief), the
   `reviewer` on risky or multi-file lanes, the `design-critic` on any lane that changes what is
   seen. A PR carries PRC-18's body; merge once all checks are green. PRs are not rationed: one
   concern per PR, as many a day as the work produces, docs included (the owner wants the history
   to show steady, coordinated work), but never an empty or padding PR.
7. **Ship.** An unattended cycle never dispatches the deploy (the session's guard on production
   deploys). When app code merged since the last deploy and `develop` CI is green, the report says
   `deploy ready: <commit>`; the owner or an attended session dispatches
   `.github/workflows/deploy.yml` and confirms it.
8. **Record.** A row in `agent-metrics.md` per lane (it rides the next PR), decision rows for
   decisions, the HQ body rewritten (lock cleared, lanes, next ten, parked, board questions).
9. **Report.** One HQ comment: what shipped (PR links), what is open, spend (agent tokens by tier),
   decisions taken, and anything the board must answer. Two to ten lines.

## Daily report (to the board)

The 18:53 cycle's HQ comment is the day's account, in Turkish (the repo stays English): shipped
today, the user-visible change in one line each, CEO taste calls with screenshots, spend against
the budget, risks, and at most three board questions, each with the CEO's recommendation and the
default that applies until answered. It ends with a push notification.

## Weekly review (Sunday)

The strategist writes a one-page memo (what moved, what the numbers say, the next week's three
themes, one bold idea); the CEO re-ranks `roadmap.md`, compares the Sonnet lanes with the Opus
baseline as `model-routing.md` says, and publishes the week as an HTML brief for the owner.

## Stop rules

- Never: push to `main`, change the licence, delete a feature, add a dependency, raise a bundle
  gate, skip or loosen a test to get green, send the owner's email anywhere, write a model name
  into the repo beyond the routing docs.
- A PR red after two fix rounds is parked with its diagnosis in the HQ issue; the cycle moves on.
- A production problem (deploy failed, the site broken) stops all new work until it is fixed or
  rolled back.
- Two cycles in a row that shipped nothing: the next one is a strategy cycle, not a build cycle.
