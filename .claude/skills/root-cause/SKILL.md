---
name: root-cause
description: Find and fix the cause of a Recto bug, red CI job or flaky test whose cause is unknown. Use before proposing any fix for a failure you have not explained.
---
<!-- Inspired by https://github.com/obra/superpowers (skills/systematic-debugging, MIT licence,
     (c) 2025 Jesse Vincent), read 2026-10-21. Adapted, not copied: rewritten for Recto. PRC-29. -->

# Root cause

No fix before the cause is proven. A fix for a symptom moves the bug and costs a later round.

## 1. Reproduce

- Make the failure happen on demand: the failing test, the steps, the engine and viewport. Note how
  often it fails if it is intermittent.
- If it does not reproduce locally, gather more evidence (CI logs, artifacts, traces) before
  guessing. Long logs go to the `log-reader` agent; ask it for the first error and its context.

## 2. Read the evidence

- Read the whole error and stack, not the first line. Note file, line and the values involved.
- Check what changed: `git log` and `git diff` around where it started.
- Trace the bad value back to where it is first wrong; that is where the fix goes.
- Compare with a working neighbour (a passing test, another engine, an earlier commit) and list
  every difference.

## 3. One hypothesis at a time

- State it in one sentence: "X happens because Y".
- Prove or kill it with the smallest test or probe that changes one thing.
- Killed: drop it and form the next one from the evidence; do not stack changes.
- After three killed hypotheses, stop and report what you tried and what the evidence shows; the
  lead decides the next step (charter: a lane parks after two fix rounds).

## 4. Fix the cause

- Write a regression test that fails before the fix and passes after it.
- Fix at the source, in the smallest change that removes the cause (`lean-change`).
- Run the covering checks and show their output (`verify-before-done`).

## Never

- Loosen, skip, retry or time-wait a test to make it pass (PRC-21); never raise a gate to fit
  (PRC-11).
- Call it "flaky" and stop. A flake is a symptom: timing, ordering, a missing wait condition, an
  engine difference or an app bug. Find which (PRC-14, PRC-19, PRC-21).
- Fix several suspected causes in one change.

## Report

The cause in one sentence with its evidence, the fix, the regression test, and the checks run with
their results.
