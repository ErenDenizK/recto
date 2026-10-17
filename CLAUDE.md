# Working on Recto

Recto is a browser-only PDF editor: Vite 8, React 19 with the React Compiler, TypeScript,
Zustand, Base UI, CSS modules over `apps/web/src/styles/tokens.css`, PDFium in a worker,
Paraglide i18n (EN/TR). Desktop and tablet get the full app and come first; phones get the
compact edition, editable since EDN-7 (pen, highlight, text, edit text, signature; ADR-0034).

## Where things live (apps/web/src)

- `shell/frame/`: top strip, title menu, page pill, DockBand, free rect (`--free-*` vars).
- `shell/capsule/`: the one morphing bottom element (shapes dock/palette/locked/pages).
- `markup/`: palette, ink strip (PresetEditor is in `annotations/pen/`). `stage/grid/`: Pages
  grid and PagesBar.
- `shell/sidebar/`: Pages, Find, Review (`shell/review/`). `home/`: LibraryView. `sample/`: the
  sample PDF.
- `shell/compact/`: the phone edition (reader, Library, sheets, overview); its editing (edit
  island, tool drawer, keyboard, selection) is `shell/compact/mark/`.
- `glass-gpu/`: the WebGL2 glass on the main pieces (GLS-7, GLS-12…GLS-15).
- Materials: `styles/materials.css` (generated) and `ui/Surface.tsx` (Glass Clear / Tinted / Solid).
- Motion tokens: `styles/motion.css`, `reducedMotion()`. Key map: `commands/keymap.ts`.
- Specs: `docs/specs/redesign.md`, `docs/design/redesign-2026-10/` (quality bar Q-1…Q-14,
  component specs). Brand: `docs/brand/`. Family (the owner's other products): `docs/family/`.
- **Decisions: `docs/process/decisions.md`.** Every owner and lead decision with its source;
  it wins over older docs. Read it before changing behaviour; add a row when you decide.
  Superseded docs are in `docs/archive/`: do not work from them.

## Branches and the owner

- Two long-lived branches: `develop` is the dev branch (all work lands here, deploys run from
  it); `main` is only for manual releases the owner asks for. Each lane lands on `develop`
  through its own pull request (PRC-17): branch, push, open the PR, merge it with a merge commit
  (never squash) once its checks are green. A PR carries one concern and the body PRC-18 sets
  (What, Why, How tested, Screenshots for UI, Decisions added); a docs-only change rides the next
  lane's PR. Commits are authored by the owner, with the `Co-Authored-By` trailer the session
  gives.
- The owner writes in Turkish, often by dictation, so read through transcription slips ("Cloud"
  usually means the AI assistant). Reply in Turkish; repo docs, code and commits stay in
  English. Ask the owner about taste; decide technique yourself and record it.

## Model routing (PRC-23, owner)

Opus 5.5 decides the "what" (plans, research, taste, unknown-cause bugs, final review); Sonnet 5.5
builds settled specs through the `implementer` agent; Haiku 5.5 reads and reports (`Explore`,
`log-reader`). Effort `medium`, never `xhigh`/`max`, only 5.5 models. Implementers stay inside the
files their brief owns and stop to ask on an unsettled decision. Details, guards and the metrics
loop: `docs/process/model-routing.md`; one row per lane in `docs/process/agent-metrics.md`.

## Rules

- Conventional Commits, header at most 100 chars, lower-case subject. Scopes: engine, model,
  ui, light-table, viewer, export, docs, build, ci, deps, fixtures. Use the commit trailers the
  session gives you. Never write an AI model name into code, comments or docs.
- Code reads like its neighbours: doc comments cite the spec section a behaviour comes from.
- User-facing strings go in `apps/web/messages/en.json` and `tr.json` (proper Turkish), then
  `pnpm --filter @pdf-editor/web i18n`; import with `import { m } from '../i18n'`.
- Never add dependencies. In a fresh worktree run `CI=true pnpm install --frozen-lockfile
  --offline` (never symlink `node_modules`).
- Never run typecheck, lint or build at the same time as vitest (Paraglide regenerates files).

## Verifying cheaply

Run only what covers your change; CI runs everything on Chromium, Firefox and WebKit. Several
worktrees share one machine: wrap every heavy command (`pnpm build`, Playwright, the full unit
suite) in `tools/dev/heavy.sh`, e.g. `tools/dev/heavy.sh pnpm build`. Lanes and concurrency:
`docs/process/agent-workflow.md`.

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` at the root.
- Unit/browser tests: `cd apps/web && pnpm exec vitest run --maxWorkers=1 <files>`.
- e2e (only when your brief asks; browser tests run last and never block a report):
  `cd apps/web && RECTO_RENDER_OVERRIDE=1 ../../tools/dev/heavy.sh pnpm build`, then
  `E2E_SKIP_BUILD=1 E2E_PORT=<port> pnpm exec playwright test <spec> --project=chromium
  --workers=1`. The override is a build-time flag the specs need (CI sets it); without it the
  build starts at Glass Tinted and glass specs fail for no real reason. Only Chromium is
  installed locally; write engine-agnostic tests.
- Tests waiting on UI use `settled(el)` from `apps/web/test/settled.ts`, not bare
  `toBeVisible()` right after an entrance animation.
- For UI work, screenshot the result at 1440×900 and at tablet size (1180×820, touch) and look
  at it before you report.
