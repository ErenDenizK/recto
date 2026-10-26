---
title: "Research: Claude Code skills for the workflow (Graphify, lean code, design, skill authoring)"
date: 2026-10-26
status: snapshot
---

> Research snapshot of 2026-10-26 for the owner's ask (Turkish, paraphrased): "improve the
> workflow with Claude Code skills: find out what Graphify is, skills that make agents write less
> and better code with fewer tokens, design skills that are good rather than generic, and a skill
> for writing skills." It follows [skills-2026-10.md](skills-2026-10.md) (21 Oct, PRC-29), which
> read the candidates' files in full; this note rechecks them, adds the design and authoring
> questions, and drafts four repo skills from R22–R29's lessons. **Nothing was installed or run.**
> Pages were read with a web fetch and treated as data. Sizes are bytes; tokens are bytes ÷ 4.

## How skills load in Claude Code today

From the Claude Code skills page (code.claude.com/docs/en/skills, read 2026-10-26) and the
skill authoring best practices (platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices,
read 2026-10-26):

- **Listing:** every skill's name and description sit in context in every session; the listing's
  budget is 1% of the context window, and each entry (description plus `when_to_use`) is cut at
  1,536 characters. When it overflows, the least-used skills lose their descriptions first.
- **Body:** loads only when the skill is invoked, by the model matching the description or by
  `/name`; it then stays in context. After compaction only the first 5,000 tokens of each invoked
  skill are re-attached (25,000 in all), so the rule that matters goes at the top.
- **Subagents:** a `skills:` list in an agent's frontmatter injects those bodies in full at start
  (how `implementer` gets `lean-change` and `verify-before-done`). `disable-model-invocation: true`
  makes a skill manual-only and blocks preloading.
- **Useful fields:** `paths` (activate only for matching files; it does not fire for files in a
  sibling worktree outside the session's directory, which is how our lanes work), `context: fork`
  with `agent` (run as a subagent), `allowed-tools`, `hooks`. Unknown fields are ignored.
- **Authoring rules:** third-person description saying what and when, key terms first; body under
  500 lines; references one level deep; one default, not a menu of options; evaluations first
  (three scenarios, a baseline without the skill); no time-sensitive text.
- **When a rule must always hold,** the docs say a skill is the wrong tool: use a hook, because a
  skill is read once and can be skipped later in a long turn.

**Against our other carriers.** `CLAUDE.md` (5.8 KB) loads in every session and every agent that
does not set `omitClaudeMd`; an agent file is the whole system prompt of one role; a skill costs
about 50 tokens of listing everywhere and its body only where used. So: rules for everyone stay in
`CLAUDE.md`, a role's standing orders stay in its agent file, and a procedure some roles need some
of the time is a skill. Our seven skills add about 600 tokens to every session's listing and
0.5–0.8K tokens each when used.

## Graphify, rechecked

[Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) (formerly `safishamsi/graphify`):
about 136k stars and 2,539 commits on 2026-10-26, MIT and Apache-2.0. A Python package
(`graphifyy` on PyPI) plus a large skill: code is parsed locally with tree-sitter into a NetworkX
graph clustered with Leiden, documents and images go to model subagents for a semantic pass, and
the output is `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`). `graphify install`
registers the skill; on Claude Code a PreToolUse hook steers Read, Glob and search calls to graph
queries; `graphify hook install` adds git hooks that rebuild on commit and checkout. The README
says no telemetry, but every query is logged to `~/.cache/graphify-queries.log` unless disabled, and
it now sells a paid cloud tier (its "80% fewer tokens" claim is about that tier, without a
method). The project's own benchmarks (key-fact coverage 82.0% against 70.8% for grep and read on
one repository) are self-reported.

**Verdict: still skip** (PRC-29 stands). Nothing changed the reasons: each cloud session starts
clean and would `pip install` remote code; the graph is stale after every merge unless committed;
the docs tree, our largest part, is exactly what it sends through model subagents; and its hooks
would override the routing that sends "where is X" to `Explore`. If search cost ever shows in
`agent-metrics.md`, trial the TypeScript language server first (skills-2026-10 row 9).

## Lean-code skills

| Candidate | Source, licence | What it is | Verdict |
|---|---|---|---|
| ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), MIT | the "lazy senior dev" ladder, plus hooks and a ledger | already adapted as `lean-change` (PRC-29); keep |
| karpathy-guidelines | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills), MIT, ~224k stars | one rules file: think before coding, simplicity first, surgical changes, goal-driven execution | **skip**: every principle is already in `lean-change`, `verify-before-done` and the implementer's stop rule; reviewers note it is guidance, not enforcement |
| superpowers | [obra/superpowers](https://github.com/obra/superpowers), MIT | a gated workflow pack with a bootstrap hook | the two good skills are already adapted (`verify-before-done`, `root-cause`); the rest conflicts with the charter |
| built-in `/simplify`, `/code-review` | ship with Claude Code | quality and bug review of a diff | **use** as the cheap pre-PR pass on small lanes that skip `reviewer` |

The token win now is not another rules pack but fewer fix rounds: R29's reds came from gates the
builders did not know to run, which is what `repo-gates` below targets.

## Design skills

- **frontend-design** (Anthropic, claude-plugins-official, Apache-2.0): its point is to pick one
  bold aesthetic direction and avoid generic looks. Community critics (chaseai.io; Justin Wetch's
  post, both 2026) argue that the general "avoid slop" line does not work by itself and that a
  model cannot see its own earlier outputs to avoid converging on them; the concrete anti-pattern
  lists are what helps. For Recto, inventing a direction is the board's call (a new identity), so
  loading it whole would push against our language. **Excerpt only:** its list of generated-look
  tells, added to `design-critic` (skills-2026-10 plan 6, not yet done).
- **Impeccable** ([pbakaus/impeccable](https://github.com/pbakaus/impeccable), Apache-2.0, ~88k
  stars): one skill with 24 commands (audit, critique, polish…), a `PRODUCT.md`/`DESIGN.md` setup,
  and a detector of 62 deterministic rules (overused fonts, grey text on colour, nested cards,
  bounce easing). **Skip installing:** telemetry is on by default (it calls `impeccable.style` when a
  design starts), the launcher downloads a native binary into `~/.impeccable/bin/`, its hooks run
  after UI edits and can fetch that binary even when the launcher is denied, and the installer edits
  `.claude/settings.local.json`. Its "visual worlds" roll is again identity invention. The useful
  part, deterministic anti-pattern rules, Recto already has in its own form: the css-scale,
  focus-scan, tokens and copy-check gates, plus the quality bar Q-1…Q-14 that `design-critic`
  judges against. Worth reading its rule list once when the critic's tells are written.
- **Recommendation:** no design skill. Our design system, the gates and a design critic with the
  quality bar give more than any generic pack; the gap is a short tells list in `design-critic`.

## Skill authoring

Anthropic's **skill-creator** (anthropics/skills, Apache-2.0; already available as a session
skill) gained evals, a benchmark mode (pass rate, time and tokens with and without the skill),
blind A/B comparison between versions and description tuning (should-trigger and should-not
prompts) in its 2026-03-03 update (claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills).
Anthropic reports better triggering on 5 of 6 of its document skills after tuning. It separates
**capability** skills (may become unnecessary as models improve: an eval shows when) from
**encoded preference** skills (a team's process: durable). All of Recto's skills are the second
kind. **Adopt as the tool** for tuning the drafts below; it needs no install.

## Drafted on `r29/workflow-skills`

Four new skills from lessons the metrics and HQ record, each under 3 KB, no scripts, hooks or
network, plus three small wiring edits:

| Skill | Lesson | Used by |
|---|---|---|
| `repo-gates` | R29: three PRs red on tokens, css-scale, focus-scan and the decisions index, three more in the queue on semantic clashes (spacing, danger colour, a test expecting the old Tools button) | preloaded by `implementer`; named in `verify-before-done` |
| `decision-rows` | four id clashes between parallel lanes (TXT-22, DSN-68/69, PRD-24 renumbered; a duplicated PRD-30 index line after a merge) | the lead when briefing (reserves ids), any lane recording a row |
| `merge-queue` | one PR at a time; catching up all PRs after each merge wastes CI (about 4.4 runner-hours a push); red-in-queue triage | the lead's heartbeats and merge passes |
| `hq-report` | the charter's HQ rules gathered in one procedure (body sections, comment order, board questions with a recommendation and a default) | the lead at the end of every cycle |

`root-cause` gains a short section on engine-only e2e reds (#141's causes); `implementer` preloads
`repo-gates`; `model-routing.md` names the lead's skills.

## Recommendation

1. Adopt no external skill or plugin. Keep the PRC-29 review gate for any future one: read every
   file it ships; reject hooks, scripts, binaries, telemetry, network fetches and "always invoke"
   bootstraps; rewrite as our own text.
2. Merge the four drafts after one tuning pass with skill-creator: three should-trigger and three
   should-not prompts each, and one eval for `repo-gates` (a CSS-only change must end with the
   style gates run).
3. Make the gates a hook as well as a skill if the next six builder lanes still go red on them: a
   project `Stop` or pre-push hook that runs the decisions index and copy check (both under a
   second, no install) cannot be skipped. That is a settings change for the lead to decide.
4. Write the `design-critic` tells list (frontend-design excerpt) as planned in PRC-29.
5. Measure in `agent-metrics.md`: first-CI-green for builder lanes before and after `repo-gates`;
   decision-id renumber commits per week (target 0); queue passes per merged PR.

## Risks

- **Stale procedure.** A skill that quotes commands goes wrong when the commands move; each one
  cites its source file so a lane changing that file can find it (`grep -rn repo-gates .claude`).
- **Listing growth.** Seven skills is far from the 1% budget, but every new skill must earn its
  place; delete one that does not move its number after six uses.
- **Skipped skills.** A skill is read once; long lanes can drift from it, which is why item 3 above
  exists.
