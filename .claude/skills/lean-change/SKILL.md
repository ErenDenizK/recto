---
name: lean-change
description: Make the smallest change that fully meets a Recto brief. Use when building, refactoring or fixing code from a settled spec, and when the lead writes a brief.
---
<!-- Inspired by https://github.com/DietrichGebert/ponytail (skills/ponytail/SKILL.md, MIT licence,
     (c) Dietrich Gebert), read 2026-10-21 at plugin v5.3.2. Adapted, not copied: rewritten for
     Recto, without its hooks, levels or ledger. PRC-29. -->

# Lean change

The best change is the smallest one that fully does what the brief asks and reads like its
neighbours. Recto's rules (CLAUDE.md, `docs/process/decisions.md`) win over anything here.

## Before you write

1. **Read first.** Read the code the change touches and grep its callers. Find the spec section or
   decision row behind the behaviour; the doc comment you write cites it.
2. **Take the first rung that fully works:**
   - Does it need to exist at all? A brief item already met, or met by deleting code, is done.
   - Reuse what the repo has: a helper, a token, a component, a test utility (`settled`, `quiet`).
   - Use the platform: DOM, CSS, Web APIs, TypeScript's standard library.
   - Use a dependency already installed. **Never add a dependency** (Recto rule), not even for a
     few lines.
   - Then the least code that does it: one line before a function, a function before a module.
3. **Delete before adding.** If the change leaves code, an export, a style or a test that nothing
   uses, remove it in the same change (PRC-22).

## While you write

- No abstraction, option, config flag or extension point the brief did not ask for.
- No speculative cases; handle the ones the spec names and the ones the platform forces.
- Finish what the change breaks: every caller, test, fixture and string it touches.
- New branching logic leaves **one small test** that fails without it. A pure move or rename needs
  none beyond the existing suite.

## Never cut

Smaller never means less safe. Keep, and add where the change needs them:

- accessibility (roles, labels, focus, keyboard, contrast);
- reduced motion (`reducedMotion()`, `styles/motion.css`);
- security and data-loss handling (validation, the user's document, unsaved work);
- i18n (strings in `messages/en.json` and `tr.json`, proper Turkish);
- tests that cover the behaviour; never loosen, skip or time-wait one (PRC-21).

## Report

End the report with what you did not do or did not check, in one line each. A known limit goes in
a doc comment citing its spec or decision, not in a separate backlog.
