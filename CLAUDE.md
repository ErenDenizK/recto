# Working on Recto

Recto is a browser-only PDF editor: Vite 8, React 19 with the React Compiler, TypeScript,
Zustand, Base UI, CSS modules over `apps/web/src/styles/tokens.css`, PDFium in a worker,
Paraglide i18n (EN/TR). Phones get a read-only compact edition (ADR 0033); desktop and tablet
come first.

## Where things live (apps/web/src)

- `shell/frame/`: top strip, title menu, page pill, DockBand, free rect (`--free-*` vars).
- `shell/capsule/`: the one morphing bottom element (shapes dock/palette/locked/pages).
- `markup/`: palette, ink strip, PresetEditor. `stage/grid/`: Pages grid and PagesBar.
- `shell/sidebar/`: Pages, Find, Review. `home/`: LibraryView. `sample/`: the sample PDF.
- Materials: `styles/materials.css` (generated) and `ui/Surface` (Glass Clear / Tinted / Solid).
- Motion tokens: `styles/motion.css`, `reducedMotion()`. Key map: `commands/keymap.ts`.
- Specs: `docs/specs/redesign.md`, `docs/design/redesign-2026-10/` (quality bar Q-1…Q-14,
  component specs). Brand: `docs/brand/`.

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
- e2e: `cd apps/web && pnpm build && E2E_SKIP_BUILD=1 E2E_PORT=<port> pnpm exec playwright test
  <spec> --project=chromium --workers=1`. Only Chromium is installed locally; write
  engine-agnostic tests.
- Tests waiting on UI use `settled(el)` from `apps/web/test/settled.ts`, not bare
  `toBeVisible()` right after an entrance animation.
- For UI work, screenshot the result at 1440×900 and at tablet size (1180×820, touch) and look
  at it before you report.
