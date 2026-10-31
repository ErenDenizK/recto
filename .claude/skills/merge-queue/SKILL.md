---
name: merge-queue
description: Drains Recto's queue of open pull requests into develop one at a time, catching each up, checking it and merging it with a merge commit. Use in a heartbeat or merge pass, when several lane PRs wait to merge, when a queued PR turns red after another merge, or before dispatching a deploy.
---

# Merge queue

One PR moves at a time: every merge makes the others stale, and a full CI run costs about 4.4
runner-hours, so catching up the whole queue after each merge wastes most of it. Rules behind this:
PRC-17 (merge commits, never squash), PRC-18 (PR body), charter "Merge pass" and stop rules.

## Order

P0 fixes first, then the platform lane, then features, clean-up and docs lanes last. Write the
order into the HQ body as `Queue: #a → #b → …` and keep it current.

## One step

1. Take the head of the queue. It may merge only when all of these hold:
   - its head contains `develop`'s tip (otherwise catch up, step 2);
   - every check on that head is green, the E2E jobs included;
   - the gate is done: scope (`git diff --stat` against the brief), `reviewer` and `design-critic`
     where the charter asks, and the PRC-18 body (What, Why, How tested, Screenshots, Decisions).
2. **Catch up** only this PR: merge `origin/develop` into its branch (a merge, never a rebase or a
   force push), resolve conflicts (`decision-rows` for the decisions files), rerun `repo-gates` for
   its files, push, and end the step. CI decides on the next pass.
3. **Merge** with a merge commit (`merge_method: "merge"`), then check that develop's own CI run on
   the merge starts.
4. Schedule the next pass about 45 minutes out (`send_later`) while the queue is not empty; stop
   scheduling when it is.

## A red PR in the queue

- Hand the failing job's log to `log-reader`; never read the log in the lead's context.
- Sort the cause before fixing: the PR's own bug (back to its lane or a fix agent); a semantic clash
  with something develop gained since (a test that expects the old UI, a token another lane moved:
  fix in the PR, inline if small); a test that fails for timing or an engine difference (`root-cause`
  lane, never a re-run to green, PRC-21).
- An infrastructure error that names no test (a 503 from GitHub, a lost runner) may be re-run once;
  say so in the report.
- Two fix rounds and still red: park it with its diagnosis in HQ and move to the next PR.

## A red develop

Nothing else merges until develop is green again; the fix goes first in the queue. Never dispatch a
deploy from a red develop or from a head that is not green on every check.
