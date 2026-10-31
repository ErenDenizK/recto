# Brief template

The standing rules every agent brief carries (PRC-35). The lead reads the open rows of `lessons.md` before writing a brief and adds any that apply. Briefs stay short and self-contained (`model-routing.md`, Briefs).

## Header

- **Objective:** one sentence and the done condition.
- **Role and effort:** judge, builder or reader, and the effort the lead chose (`model-routing.md`).
- **Scope:** files the lane owns; files it must not touch. Stray edits are sent back.
- **Decisions to cite:** the ids (`decisions.md`) and spec sections the behaviour comes from. On an unsettled decision the agent stops and reports the question.
- **Verify commands:** only what covers the change (`CLAUDE.md`, Verifying cheaply).

## Standing rules

1. **Heavy lock (L1).** Run heavy commands through `tools/dev/heavy.sh`. If the lock is busy, do not poll: skip build, lint and typecheck, say so in the report (CI runs them). At most 2 heavy users at once.
2. **YAML and workflow edits (L3).** Diff against base and list every removed key in the report.
3. **Forget path (L6).** Every new storage ships with a Clear/forget test in every edition.
4. **Deterministic tests (L7).** No either/or assertions; hold async work on a promise the test releases.
5. **Parsers and NLP (L4).** Ship an adversarial probe set as tests, not only the builder's own corpus.
6. **Chained page operations (L5).** Resolve pages to ids before commit.
7. **No background processes (L2, L12).** Leave none running at the end; no long background loops, run repeats in the foreground in batches. The lead stops finished agents.
8. **Visual work (L10, L11).** Design for the host first (iframe, phone, permission prompt); check the brand files on `develop` before starting.

## Report format

At most 8 lines: what changed (files, diff stat), checks run and their result, checks skipped and why, removed YAML keys if any, open questions, and the PR link. No claim that a check passed unless it ran.
