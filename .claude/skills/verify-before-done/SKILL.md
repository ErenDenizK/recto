---
name: verify-before-done
description: Prove a Recto change works before reporting it done, green or fixed. Use before every completion report, and when the lead gates a lane before its pull request.
---
<!-- Inspired by https://github.com/obra/superpowers (skills/verification-before-completion,
     MIT licence, (c) 2025 Jesse Vincent), read 2026-10-21. Adapted, not copied: rewritten for Recto.
     PRC-29. -->

# Verify before done

No claim of "done", "passes", "green" or "fixed" without fresh evidence from this run.

## Steps

1. **Name the proof.** For each claim, name the command that proves it. Start from the checks the
   brief lists; if it lists none, take the ones that cover the change:
   - `pnpm format:check`, `pnpm lint`, `pnpm typecheck` at the root;
   - `cd apps/web && pnpm exec vitest run --maxWorkers=1 <files>` for the covering tests;
   - e2e only when the brief asks (CLAUDE.md "Verifying cheaply": `RECTO_RENDER_OVERRIDE=1`
     build through `tools/dev/heavy.sh`, then the spec on Chromium).
   A change to CSS, tokens, strings, ids or decisions also runs the repo-wide gates in
   `repo-gates`; a focused run never reaches them.
   Heavy commands go through `tools/dev/heavy.sh`; never run typecheck, lint or build at the same
   time as vitest.
2. **Run it now,** after your last edit. An earlier run, another lane's run or "it should pass" is
   not evidence.
3. **Read the result:** the exit code, the pass/fail/skip counts, and any warning. A skipped or
   filtered-out test is not a pass.
4. **Claim with the evidence.** In the report, give each command with its outcome (the summary line
   or counts, the failure if any). If a check fails or could not run, say so plainly; do not round
   it up to green.

## UI changes

Screenshot the result at 1440 × 900 and at tablet size (1180 × 820, touch), look at both, and
attach or describe them. A UI change without screenshots is not done.

## Checking someone else's report

An agent's "done" is checked against `git diff --stat` (files match the brief's scope) and against
CI or a fresh local run, never trusted alone.
