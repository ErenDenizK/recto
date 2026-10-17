# Model routing (template)

Copy into a project's `docs/process/`, fill the examples column, and link it from `CLAUDE.md`. Only
5.5 models (the owner's rule). Keep the agent definitions in `.claude/agents/` (Explore, log-reader,
implementer, reviewer; copy them from Recto and change the repo-specific lines).

## The rule

Opus decides the "what", judges taste and gives the final review; Sonnet does the "how" from a
settled spec; Haiku reads and reports. Effort `medium`; never `xhigh` or `max`.

| Work | Model | Agent | This project's examples |
|---|---|---|---|
| Lead: plans, briefs, merges, final say | Opus 5.5 | main session | |
| Research, concepts, taste, design language | Opus 5.5 | general-purpose with `model: "opus"` | |
| Bugs with an unknown cause, profiling, risky cross-module change | Opus 5.5 | general-purpose with `model: "opus"` | |
| Building a settled spec; refactors, tests, docs, copy; CI fixes with a known cause | Sonnet 5.5 | `implementer` | |
| Review before a risky or multi-file PR | Opus 5.5 | `reviewer` | |
| Search, inventories, CI and test logs, doc checks | Haiku 5.5 | `Explore`, `log-reader` | |

## Guards

- Scope: every implementer brief names files in scope and out of scope; the lead checks
  `git diff --stat` against it before the PR and sends stray edits back.
- Stop rule: an implementer that meets an unsettled decision stops and asks; it does not guess.
- Briefs: objective, decisions to read, files in and out of scope, checks, output, done condition.
- Haiku: read-only, prompts under 100K tokens, no code edits.
- No mid-run model or effort switches.

## Measurement

Keep `agent-metrics.md` (template beside this file). Record the first rounds on the current models
as a baseline; after four to six lanes per new routing, compare like with like and move work where
the numbers say so.
