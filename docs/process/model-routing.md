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

## Routing matrix (lead, 2026-10-31)

Within PRC-35 (the lead picks effort per task), these are the defaults the lead starts from; a brief may deviate when it says why. Evidence is the ledger (`agent-metrics.md`: R21–R24 and the 27 runs of 2026-10-31) and the lessons (`lessons.md`); a cell marked *hypothesis* has no measurement behind it yet and is in the experiment plan below.

What the two knobs do, from Anthropic's API guidance (read 2026-10-31): effort scales how much the model thinks and how many tool calls it makes, inside one model; lower effort means fewer, more consolidated tool calls and terser output, and at `low` an agent is more likely to stop before finishing or skip verifying. Effort names are calibrated per model, so "medium" on the judge and "medium" on the builder are not the same amount of thinking. The judge model costs twice the builder per input and output token, while cache reads cost the same on both, so on our cache-heavy lanes the real price gap is under 2×. The vendor's measured curves: research and knowledge work are nearly flat (`medium` matched `high`), long-horizon coding is a real trade (each step down loses a few points), and a larger model at lower effort sometimes costs less per solved task than a smaller one at higher effort. Price per completed task, not per run: a cheap lane that needs a fix lane is not cheap.

Ledger tokens include cache reads, so they track volume, not the bill. On 2026-10-31 the judge at high took 1.80 M (31 %), the builder at medium 2.84 M (49 %), the builder at high 1.09 M (19 %), the reader 0.12 M.

| Kind of work | Default | Why | Evidence |
|---|---|---|---|
| Lead: orchestration, briefs, final say | judge high | PRC-35 | — |
| Spec / plan | judge high | The spec is where a cross-file invariant is cheapest to state; a miss there costs a review blocker and a fix lane | 2 specs, 478K, 29 min, 8 lanes. Both still left a gap later caught in review: chained page operations by position (L5, 3 blockers, 168K fix lane) and no probe set for the parser (L4). More effort would not have helped there; the spec checklist does (below) |
| Taste, colour, design direction | judge high | Taste is grasp of scope (host, brand, the whole product), the judge's job | Colour lab 258K, delivered, but on the old logo (L11: check brand files first). HQ v8 320K, owner: usability bad; the cause was the host (iframe, phone) and no critic before publish (L10), not effort |
| Adversarial review of risky logic (parser, state, storage, chained operations, privacy, CI workflows) | judge high | Finding what is missing is search: depth and number of tries | 4 reviews, 401K, 18 min, 20 blocking findings (1, 4, 11, 4), about 20K tokens per blocker. The fix lanes for those blockers cost 168K and 349K; a blocker found in CI or on `develop` costs more |
| Routine review (one concern, small diff, no new state) | judge medium | Vendor: the judge model at its default effort reviews well with few false alarms | 3 reviews at judge medium (R22–R24): 155K, 2 blockers, and one miss: the R23 modal lane's regression (a toast over a sheet's button) passed review and turned tablet e2e red. One data point; experiment A |
| Design critique | judge high | Same reason as taste | 2 critiques, 340K, 74 items; the 16 on Masa and Niyet were all real and the builder at medium fixed every one. Whether medium finds the same items is a *hypothesis*; experiment D |
| Settled build (spec or decision row exists) | builder medium | The vendor's starting point for agentic coding; the spec carries the scope | 5 builds, 1.93 M, 293 min. Every one came back once, but the causes were the spec (L5), a missing probe set (L4), a missing forget-path test (L6), design send-backs (16 items) and the heavy lock (L1, about 0.5 M of polling), not a misread spec |
| Logic-heavy build (parser, state machine, storage, chained operations) | builder medium plus a probe set and the spec checklist | The edge cases are an information gap first: once the reviewer's probes existed, the builder fixed all ten misreads | N1 parser chain 974K (build 478K, review 147K, fixes 349K); N2 runner chain 827K. Whether builder high would have shipped fewer misreads is a *hypothesis*; experiment C |
| Subtle fix (a known failure, the right fix is not obvious) | builder high | The failure mode at medium is the shallow fix | Builder high: 2 fix lanes (517K) fixed all 13 findings; each re-check found one more. Builder medium: #160's first fix branched on the control type (L7), the lead rejected it. Builder high vs judge medium is experiment B |
| Root cause, localised (one test, one flake, one module) | builder high | Scope is small, so the builder grasps it; effort buys the repeats | 2 of 2 found (323K, 24.5 min): container-transform flake, phone-land e2e (5.5 min). The judge's 4 root-cause lanes in R21–R23 took 126–281K each, at up to twice the price per token |
| Root cause, unknown or cross-module (engine, worker and UI; no repro) | judge high | Grasping which modules are involved is the hard part | PRC-23's examples (press origin, WebKit mask decoding). The lead also escalates here, with a new brief, when a builder root-cause lane comes back without a reproduced cause |
| Flaky-test root cause | builder high | As localised root cause; the `root-cause` skill carries the method | Same 2 runs; the container-transform lane stopped twice before committing, which was its background loop (L12), not its effort |
| Merge pass, PR queue, clerical | builder medium | No judgement to deepen; tokens are reading volume | 3 merge runs, 622K: 9 PRs in four passes, a conflict, a queue. One miss (the kept-names test after #159) is a repo gate (`repo-gates`), not effort |
| HQ and content writing | builder medium; the lead writes what the board decides | The facts come from the brief; effort cannot correct a wrong brief | HQ clerk at builder high, 246K: it wrote the lead's recommendations over the owner's answers because the brief said so (L8). High bought nothing; *hypothesis* that medium does the same work for less |
| Research, options for the owner | judge medium; high when it decides taste | Vendor: research curves are flat, `high` bought nothing over `medium` | R23 conversion research at judge medium (68K) and R22 research before effort was set (124K), both used |
| Log reading, inventories, "where is X" | builder medium (reader role, PRC-35) | Reading needs no depth; the floor is the builder | 12 of 12 CI log reads correct in R21–R22, and the 2026-10-31 deploy read (122K, 0.8 min, right cause). The `Explore` and `log-reader` frontmatter still says `low` and follows PRC-35 in an agents change |

**The spec checklist** (the process fix that beat both knobs on 2026-10-31): a spec for logic-heavy work names its invariants across files (ids, not positions, for chained page operations), ships an adversarial probe set as tests (L4), names the forget path of every new storage (L6), and names the host constraints of any new surface (L10). The judge writing the spec runs through it before the lanes open.

## Symptom → adjustment

The lead reads a lane's result, names the symptom, and changes one thing for the next lane of that kind (never mid-run). The cheapest change comes first: a process fix, then effort (same price per token), then the model.

| Symptom | Adjustment | Evidence |
|---|---|---|
| Shallow fix: patches the symptom, hedges a test (either/or), skips the reason | Raise effort (medium → high) | #160 at builder medium; the builder-high fix lanes landed complete fixes |
| Stops early or before verifying | First rule out process (background loops L12, the heavy lock L1); then raise effort | The container-transform lane stopped twice at high: the cause was its loop |
| Misses edge cases in the code it owns | Add the probe set to the brief; raise effort if misses remain with probes in hand | N1: ten misreads at medium, all fixed once the probes existed |
| Misreads the spec, wrong abstraction, scope error, misses a cross-file consequence | Bigger model for that kind of work, or move the invariant into the spec | N2's stale page positions: the spec did not state it, the judge's review caught it, the builder fixed it once named |
| Loops, polls, over-explores a settled task (many tool calls, little diff) | Fix the environment first; then lower effort | N2: 508 tool calls, most polling the heavy lock (L1); the rule, not effort, fixed it |
| Many tokens for clerical output | Lower effort | HQ clerk at high, 246K |
| Wrong because the brief or board state was wrong | Fix the brief; neither knob | L8, L11 |
| Destructive or careless edit (a removed workflow block) | Brief rule: diff against base and list removed keys | L3 |
| Owner rejects a look | Host constraints and a critic before publish; not effort | L10 |

## The owner's principle, tested

The principle: effort is how hard and how many times the model tries; model size is how much of the scope it grasps. Too little thinking → raise effort; too little understanding → bigger model.

- **Holds.** Shallow fixes went away at higher effort (#160 at medium vs the builder-high fix lanes). Adversarial review at high found 20 blockers for 401K; review at medium found 2 for 155K and let one regression through (confounded: the high reviews saw riskier lanes). Localised root causes needed effort, not size: the builder at high found 2 of 2.
- **Breaks: a third knob, information.** Of the twelve lessons of 2026-10-31, only L7 (a hedged test) reads as too little effort and none as too small a model; the rest are what the agent was told or what the environment did: the spec (L5), no probes (L4), no forget-path rule (L6), the brief (L8, L11), the host (L10), the lock (L1), loops (L2, L12), an unchecked edit (L3), no schema check (L9). The judge at high wrote both specs and still missed the page-mapping invariant; a second pass (the review) caught it more cheaply than more effort on the first pass would have. Rule: if a model does not know enough, the brief is too thin.
- **Breaks: high effort on clerical work.** Effort deepens judgement; where there is none to deepen it only adds tokens (HQ clerk at high, 246K, the error came from the brief). *Hypothesis* until the clerk runs at medium.
- **Breaks: a bigger model at medium can beat a smaller one at high.** The vendor reports this for the current judge model at its default effort, most on code review and multistep coding. For us it is a *hypothesis*; experiments A and B test it.
- **Breaks: "stops early" is not always effort.** At high, an agent still stopped when its own background loop woke it (L12).

## Experiments, week of 2026-11-01

Four A/B tests, run from the lanes the roadmap already brings (no lane is invented for a test). Small samples only show large differences: each decision is provisional and checked again after the next six lanes of the kind. Each lane's row carries the **Kind** and **Arm** columns (`agent-metrics.md`). Cost compares **cost units** (tokens × 2 for the judge, × 1 for the builder) over the whole chain to merge: the lane, its review and its fix rounds.

| Id | Kind | Arms | Design | Sample | Metric | Decision rule |
|---|---|---|---|---|---|---|
| A | Routine review | judge medium, judge high, builder high | Paired: the same PR gets all three reviews independently, none sees the others; the lead merges the union of findings | 6 PRs (18 reviews, about 1 M tokens) | Blocking findings earned (CI would not have caught them), escapes (a blocker any other arm, CI, the re-check or the owner found within 7 days), false alarms, cost units | Keep the cheapest arm that has no more escapes than judge high and finds at least 80 % of judge high's earned blockers. If builder high qualifies, routine review moves to the builder (PRC-35: no loss) |
| B | Subtle fix and localised root cause | builder high, judge medium | Alternate by order of arrival | 4 lanes per arm | Fix rounds, lead rejections, false greens, recurrence in 2 weeks, cost units to merge | Judge medium wins only if it has fewer fix rounds plus rejections in total and its cost units to merge are at most 1.5× builder high's; otherwise builder high stays |
| C | Logic-heavy build (with probe set and spec checklist in both arms) | builder medium, builder high | Alternate by order of arrival | 3 lanes per arm (Niyet and Masa follow-ups) | Review blockers per lane, fix-lane tokens, cost units to merge | Builder high becomes the default if it halves review blockers and its cost units to merge are not higher; otherwise medium stays |
| D | Design critique | judge medium, judge high | Paired on the same screens, independently | 3 critiques per arm | Items the lead accepts, items the owner raises later that the critique missed, cost units | Medium becomes the default if it finds at least 80 % of high's accepted items and no owner-raised item that high found |

The HQ clerk runs at builder medium this week (it is the default above); its cost and its errors are compared with the 2026-10-31 run, no second arm. On 2026-11-08 the lead writes the result per experiment in the HQ issue, changes the matrix where a rule fired, and records the change as a decision row.

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
- **The reader stays narrow.** Read-only, one narrow question per agent, never code edits.
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

From 2026-11-01 each row also names its kind (the routing matrix row), its experiment arm, its tool calls, its escapes and its cost units (`agent-metrics.md`), so the matrix is checked kind by kind, not lane by lane.

A project-neutral copy of this rule and of the metrics table is in `docs/process/templates/` for the
owner's other projects.
