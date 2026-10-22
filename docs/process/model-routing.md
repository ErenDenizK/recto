# Model routing for Recto's agent lanes

**Status:** owner-approved, 2026-10-17 (PRC-23); applies from the lanes opened after R22's routing
PR. Inputs: the owner's routing report (2026-10-17: Opus 5.5 vs Sonnet 5.5 vs Haiku 5.5, vendor and
independent numbers), the lead's measurement of R21–R22 (`agent-metrics.md`), and the portfolio
project's routing (the same owner, the same rule). The owner's fixed rule: only 5.5 models.

## The rule

Opus decides the "what", judges taste and gives the final review; Sonnet does the "how" from a
settled spec; Haiku reads and reports. Effort is `medium` everywhere unless a measured gain says
otherwise; never `xhigh` or `max`.

| Work | Model | Agent | Recto examples |
|---|---|---|---|
| Lead: plans, turns briefs into lanes, merges, final say | Opus 5.5 | main session | the owner's sessions |
| Research, concepts, options for the owner, motion and visual language | Opus 5.5 | general-purpose / Plan with `model: "opus"` | C-11 sheet research, the scroll bar concept, MOT-12…16 |
| Bugs with an unknown cause, performance profiling, risky cross-module change | Opus 5.5 | general-purpose with `model: "opus"` | the press-origin bug behind a flaky e2e, WebKit mask decoding (MOT-8) |
| Building a settled spec (a decision row or a precise brief exists) | Sonnet 5.5 | `implementer` | DSN-53 panels, the gear, Cancel on Save a copy |
| Refactors, test rewrites, doc moves, copy fixes, CI fixes with a known cause | Sonnet 5.5 | `implementer` | X1 helpers, PRC-21 waits, the archive, a spec following a moved command |
| Review before a risky or multi-file PR opens | Opus 5.5 | `reviewer` | an `implementer` lane touching many files |
| Search, inventories, "where is X", reading CI and test logs, doc checks | Haiku 5.5 | `Explore`, `log-reader` | every red CI job |

The lead names the model on each spawn (`model:` on the Agent call, or the agent's frontmatter):
the per-call value wins over frontmatter, which wins over the main model. Taste-bearing lanes that
also build (a new look, a new motion) stay on Opus; when the look is settled in a decision row, the
build can go to Sonnet.

## Guards

- **Scope.** Sonnet was measured writing outside its folder more often than Opus. Every
  `implementer` brief names the files it owns and the files it must not touch; before the PR opens
  the lead compares `git diff --stat` for the lane with that list and sends stray edits back.
- **Stop rule.** An `implementer` that meets a decision the brief and the decisions (`decisions.md` and its
  area files) do not settle stops and reports the question; the lead or an Opus agent decides. It does not guess.
- **Review.** A risky or multi-file Sonnet lane gets the Opus `reviewer` before its PR opens; other
  lanes rely on CI's full matrix and the lead's diff read (owner, 2026-10-17).
- **Briefs.** Short and self-contained: objective, decisions to read, files in scope, files out of
  scope, checks to run, output, done condition. Large handovers burn usage.
- **Haiku stays narrow.** Read-only, prompts under 100K tokens (its price steps up five times above
  that), never code edits.
- **Skills (PRC-29).** `implementer` preloads `lean-change` and `verify-before-done` through its
  `skills:` frontmatter. A root-cause brief (general-purpose agent, no frontmatter of ours) names
  the skill in its first line: "Invoke the `root-cause` skill first (`.claude/skills/root-cause/`)."
- **No mid-run switches.** A lane keeps its model; a harder task than expected is reported and
  re-briefed, not escalated inside the same agent.

## Measurement

`agent-metrics.md` keeps one row per agent: lane, model, effort, tokens, minutes, whether the PR's
first CI run was green, the number of fix rounds, stray files found by the scope check, and the
reviewer's blocking findings. R21–R22 are the Opus baseline. After the first four to six Sonnet
lanes the lead compares them with Opus lanes of the same kind (first-run green, fix rounds, stray
edits, tokens) and moves a kind of work back to Opus where Sonnet costs more rework than it saves.
The savings go to more parallel lanes or deeper research, not to less work.

A project-neutral copy of this rule and of the metrics table is in `docs/process/templates/` for the
owner's other projects.
