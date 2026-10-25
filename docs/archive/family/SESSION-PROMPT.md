# Prompt for Recto's family session

> **Türkçe özet:** Recto oturumu için hazır komut: CLAUDE.md'yi, `docs/family/` klasörünü ve aile
> kitini oku; önerileri seçenek olarak sun; imzaları asla düzleştirme; arayüze dokunmadan önce
> sor; repo kontrollerini yeşil tut. Gren kaydı 2026-10-10'da B seçeneğiyle düzeltildi.
>
> **Updated 2026-10-10 (owner):** the grain record is resolved (option B, decision DSN-22), so
> the first task below is done. Every project has two branches, dev and `main`: all work lands
> on the dev branch (Recto's is `develop`, which deploys), `main` only takes manual releases
> (decision PRC-5). The old line "never push to `develop`" is withdrawn.

Paste everything below the line into a new session opened on this repository.

---

You are working on Recto, the owner's browser PDF editor, for the maker's family of products
(Recto, English Prep, Eat Map and the portfolio at erendenizk.github.io). The family's idea:
each product keeps its own character and they meet at a shared origin, light on a dark ground
of each product's own temperature. Recto adapts only by opting in, one small move at a time,
with my yes.

**Read first, in this order, before proposing anything:**

1. `CLAUDE.md` and every rule in it (commits, scopes, i18n, no new dependencies, verification).
2. `docs/family/README.md` (Recto's DNA, untouchables, the ranked moves, the grain correction),
   `docs/family/world.json` and `docs/family/kit/` (the shared kit: charter, light, motion,
   the `edk.` mark, presentation). If `docs/family/kit/` is missing, ask me for the portfolio
   repo's `docs/family-kit/` and stop until you have it.
3. `docs/design/redesign-2026-10/quality-bar.md`, `language.md`, ADR-0023 to ADR-0028 and
   `docs/brand/README.md`, so you know why each value is what it is.

**First task (done 2026-10-10, option B): resolve the grain record with me.** `docs/family/README.md` §6 lists every place
that records "no grain" (quality bar Q-1, `language.md`, ADR-0024, the redesign spec, ADR-0033,
`materials.test.ts`, the Library aura's comments). My clarification: on 2026-10-04 I asked you
to fix the glass object's wrong render and its banding; I did not ask for grain to be banned.
Show me the list, explain options A, B and C from §6 in plain words, and wait for my choice.
Then make exactly that change: keep my original quote as it was said, correct the rule's
wording and history, amend ADR-0024, and change `materials.test.ts` only if the option I chose
needs it. One commit, scope `docs` (or `ui` if the test changes).

**Then propose the moves as options, never as a plan already decided.** `docs/family/README.md`
§4 ranks them: the spring grammar as a mapping only (no value changes), the credits line on
About in Recto's style with `edk.` and a lime dot, About v2 (it is still the old page), the
social card and press kit. For each: what changes, what a user sees, what it costs, how it is
tested, and what it must not touch. Ask me which ones to do. Ask before every change a user can
see, and show screenshots at 1440 × 900 and at 1180 × 820 (touch) before you report it done.

**Never flatten Recto's signatures.** The one lime `#c8fb3d` touching ink and never on the page;
the white page as the brightest thing; the morphing glass capsule; glass M1–M5 and its rules;
the aurora as event light, still at rest; zero-bounce surfaces and idle frames = 0; the
"Dengeli" R and its gradient (I designed it; no effects on it); Inter Recto, sentence case,
Phosphor outline → fill; A-1…A-24. If a family idea touches one of these, the family idea
loses: tell me, and do not do it. The kit never overrides Recto's own ADRs.

**Keep the repo green.** Follow `CLAUDE.md`'s cheap verification: `pnpm format:check`,
`pnpm lint`, `pnpm typecheck`, and the vitest or Playwright specs that cover your change
(never typecheck, lint or build at the same time as vitest). User-facing strings go to
`apps/web/messages/en.json` and `tr.json` in proper Turkish. Conventional Commits with the
repo's scopes. All work lands on `develop` (the dev branch, which deploys); never push to `main`
unless the owner asks for a release.

**Captures.** `pnpm --filter @pdf-editor/media-tool family` re-shoots the family captures
(`tools/media/family/`, output in `tools/media/out/family/`). Re-run it after any visible
change, move `docs/family/world.json`'s `source.commit` to the commit you shot, check it still
validates against `docs/family/kit/world.schema.json`, and hand over `world.json` plus the
captures as the kit's `presentation.md` §1 and §5 say: a `recto/` folder in your scratch space
for the portfolio's lead, never a push to the portfolio.

Write to me in English; I may answer in Turkish, often by dictation, so read through
transcription errors and confirm names before you write them down.
