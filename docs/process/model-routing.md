# Model routing for Recto's agent lanes

**Status:** owner-approved, 2026-10-17 (PRC-23); applies from the lanes opened after R22's routing
PR. Inputs: the owner's routing report (2026-10-17: the three tiers compared, vendor and
independent numbers), the lead's measurement of R21–R22 (`agent-metrics.md`), and the portfolio
project's routing (the same owner, the same rule). The owner's fixed rule: only 5.5 models.
The docs name the tiers by role (judge, builder, reader), never by model name; each agent's `model:`
in `.claude/agents/` and the lead's spawn calls say which model fills a role.

## The rule

The **judge** decides the "what", settles taste and gives the final review; the **builder** does the
"how" from a settled spec; the **reader** reads and reports. Effort is `medium` everywhere unless a measured gain says
otherwise; never `xhigh` or `max`.

| Work | Role | Agent | Recto examples |
|---|---|---|---|
| Lead: plans, turns briefs into lanes, merges, final say | judge | main session | the owner's sessions |
| Research, concepts, options for the owner, motion and visual language | judge | general-purpose / Plan on the judge model | C-11 sheet research, the scroll bar concept, MOT-12…16 |
| Bugs with an unknown cause, performance profiling, risky cross-module change | judge | general-purpose on the judge model | the press-origin bug behind a flaky e2e, WebKit mask decoding (MOT-8) |
| Building a settled spec (a decision row or a precise brief exists) | builder | `implementer` | DSN-53 panels, the gear, Cancel on Save a copy |
| Refactors, test rewrites, doc moves, copy fixes, CI fixes with a known cause | builder | `implementer` | X1 helpers, PRC-21 waits, the archive, a spec following a moved command |
| Review before a risky or multi-file PR opens | judge | `reviewer` | an `implementer` lane touching many files |
| Search, inventories, "where is X", reading CI and test logs, doc checks | reader | `Explore`, `log-reader` | every red CI job |

The lead names the model on each spawn (`model:` on the Agent call, or the agent's frontmatter):
the per-call value wins over frontmatter, which wins over the main model. Taste-bearing lanes that
also build (a new look, a new motion) stay with the judge; when the look is settled in a decision row, the
build can go to the builder.

## Effort and floor (PRC-35, owner, 2026-10-31)

No model below the builder tier: the reader role is filled by the builder model at medium effort, so log reading moves off the smallest model (the `Explore` and `log-reader` agents' `model:` follows). The lead chooses effort per task:

| Work | Role | Effort |
|---|---|---|
| Specs, taste, adversarial review of risky logic, orchestration | judge | high |
| Routine reviews | judge | medium |
| Subtle fixes and root causes | builder | high |
| Settled builds, merges, clerical work, log reads | builder | medium |

The ledger (`agent-metrics.md`, `lessons.md`) measures this; a kind of work moves to the builder where the measurements show no loss. This amends the effort line above ("medium everywhere"): `xhigh` and `max` stay out.

## Guards

- **Scope.** The builder was measured writing outside its folder more often than the judge. Every
  `implementer` brief names the files it owns and the files it must not touch; before the PR opens
  the lead compares `git diff --stat` for the lane with that list and sends stray edits back.
- **Stop rule.** An `implementer` that meets a decision the brief and the decisions (`decisions.md` and its
  area files) do not settle stops and reports the question; the lead or a judge agent decides. It does not guess.
- **Review.** A risky or multi-file builder lane gets the judge-role `reviewer` before its PR opens; other
  lanes rely on CI's full matrix and the lead's diff read (owner, 2026-10-17).
- **Briefs.** Short and self-contained: objective, decisions to read, files in scope, files out of
  scope, checks to run, output, done condition. Large handovers burn usage.
- **The reader stays narrow.** Read-only, prompts under 100K tokens (its price steps up five times above
  that), never code edits.
- **Skills (PRC-29).** `implementer` preloads `lean-change`, `verify-before-done` and `repo-gates`
  through its `skills:` frontmatter. The lead uses `decision-rows`, `merge-queue` and `hq-report`
  when it briefs, merges and reports. A root-cause brief (general-purpose agent, no frontmatter of ours) names
  the skill in its first line: "Invoke the `root-cause` skill first (`.claude/skills/root-cause/`)."
- **No mid-run switches.** A lane keeps its model; a harder task than expected is reported and
  re-briefed, not escalated inside the same agent.

## Measurement

Every past, present and future lane is kept as data (owner, 2026-10-31): the lead adds the day's rows to `agent-metrics.md` and mirrors them to the HQ console's metrics doc. Failures become rows in `lessons.md` the same day, and the standing rules in `brief-template.md` carry the prevention.

`agent-metrics.md` keeps one row per agent: lane, model, effort, tokens, minutes, whether the PR's
first CI run was green, the number of fix rounds, stray files found by the scope check, and the
reviewer's blocking findings. R21–R22 are the judge baseline. After the first four to six builder
lanes the lead compares them with judge lanes of the same kind (first-run green, fix rounds, stray
edits, tokens) and moves a kind of work back to the judge where the builder costs more rework than it saves.
The savings go to more parallel lanes or deeper research, not to less work.

A project-neutral copy of this rule and of the metrics table is in `docs/process/templates/` for the
owner's other projects.
