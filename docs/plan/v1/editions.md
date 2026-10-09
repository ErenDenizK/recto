# R13: Editions without a fork (web, desktop, phone)

Date: 2026-10-09 · Input to the integrated roadmap · Status: proposal. Nothing here is built.
No new dependencies: this is a plan. It would become **ADR-0034 "Targets, shells and
capabilities"**, which amends ADR-0007 (desktop as escalation path) and ADR-0033 (compact
edition), and replaces VISION's non-goal "Native desktop apps (a Tauri wrapper is a v3
consideration)".

Owner direction it answers (2026-10-09, in translation): the web edition is browser-only,
installs nothing, and is local, safe, very fast and optimised, with every core feature working
flawlessly. A later installable **desktop** edition holds what needs personal data or profiles
("My info" autofill), API connections and heavier components, so the web stays lean. On
**phones** (not tablets), the edition is read-only today; later it becomes an editable edition
designed from scratch for touch. **V1** is the desktop-browser and iPad web app. Only the owner
declares V1.

---

## 0. Summary

1. **One codebase, two orthogonal switches, one capability list.**
   - **Target** is chosen at **build time**: `web` | `desktop`. It decides what gets *compiled
     in*. Web builds contain zero desktop bytes.
   - **Shell** is chosen at **run time**, once per launch, by device: `full` | `compact`
     (later `phone`). This is today's `shell/frame/edition.ts`, unchanged.
   - **Capabilities** are detected at **run time**: `saveInPlace`, `fileLaunch`, `watchFiles`,
     `secureStore`, `network`, and so on. Features ask for a capability, never for a target or
     a browser (ADR-0007 §5, kept).
   - The owner's three editions map onto these:
     **Recto Web** = target `web` + shell `full`.
     **Recto on phones** = target `web` + shell `compact`/`phone`, at the same URL.
     **Recto Desktop** = target `desktop` + shell `full`.
2. **Desktop technology: Tauri 2, after V1.** Electron is the fallback if a WebKit webview
   blocks a must-have feature. An **installed PWA** is *not* a separate edition. It is the web
   edition with progressive extras (file handling, save in place on Chromium), and those extras
   never gate V1.
3. **The desktop edition is a superset.** It runs the same UI, and every web feature behaves
   identically in it. Desktop-only features plug into existing extension points (settings
   sections, commands, fill providers, Library sources). They do not get their own screens in
   the shared shell.
4. **Placement rule (§6).** A feature goes to desktop if it needs one of these:
   - **persisted personal identity** or credentials,
   - **network beyond the app's origin**,
   - a **heavy native or model component**,
   - **OS integration** that runs without the window open (background or OS-level).

   Otherwise it goes to web. Whether it lands in V1 or later is decided by the V1 criteria.
5. **Before V1, do only the cheap guards that protect the web:**
   - the `__TARGET__` define (always `web` for now),
   - a lint fence around browser file and update APIs,
   - **bundle budgets in CI**,
   - **splitting the engine barrel off the main thread's critical path** (§7). That last one is
     a real speed win for V1 with no UI change.

   The platform-port refactor and everything Tauri-related wait until after V1.

---

## 1. What exists today (read from the repository)

| Piece | Where | Relevance |
|---|---|---|
| Device shell decision | `apps/web/src/shell/frame/edition.ts` | Decides `compact` or `full` once at launch: coarse pointer and shorter screen side under 600 px means compact. `?edition=` override, `data-edition` on `:root`. **Keep as is**; it is the *shell* switch. |
| Per-shell lazy chunks | `apps/web/src/main.tsx` | `CompactApp` (≈33 KB gz) or `app.tsx` (≈419 KB gz) loads lazily. A phone never downloads the full shell. This is the pattern the target split copies at build time. |
| Platform-agnostic core | ADR-0007 §2: `packages/document-model`, `packages/engine` | No DOM except through injected adapters (file I/O, worker creation, storage). Already the precondition for a desktop target. |
| Browser file and storage APIs | `files/open-files.ts`, `files/save.ts`, `files/recents.ts`, `export/deliver.ts`, `export/save-copy-*.ts`, `tools/deliver-file.ts`, `session/storage.ts`, `session/opfs-writer.worker.ts`, `batch/recipes-store.ts` | These are the touchpoints that become the **web adapter** of a platform port (§5). |
| Update flow | `pwa/register.ts`, VitePWA `registerType: 'prompt'` | Web-only. Desktop uses a native updater instead. |
| Privacy promise | `privacy/csp.ts`, `privacy/external-requests.ts`, meta CSP `connect-src 'self'` (ADR-0004) | The web's "zero external requests" is a *product guarantee*. It is the reason network features live on desktop. |
| Personal-ish data already on web | `signatures/saved-signatures.ts`, `shell/comment-author.ts`, `ui/colour/saved-colours.ts`, `files/recents.ts` | User-made, explicit, local and forgettable. They stay on web (rule in §6.2). |

**Measured web bundle** (`apps/web/dist`, built 2026-10-09 09:43; gzip -6):

| Chunk | Raw | Gzip | Loaded |
|---|---|---|---|
| `main` (entry: React, edition pick, SW register) | 229 KB | 72 KB | always |
| `app` (full shell) | 1.25 MB | 419 KB | full shell, at launch |
| `src-*` (the `@pdf-editor/engine` barrel: fontkit, pkijs, PDFium host glue, …) | 1.68 MB | **515 KB** | **statically imported by `app`**, so it is on the launch path |
| `CompactApp` | 95 KB | 33 KB | phone, at launch |
| `app.css` | 242 KB | — | full shell, at launch |
| `pdfium.wasm` | 4.6 MB | 2.1 MB | first document (runtime-cached) |
| `qpdf.wasm` | 3.0 MB | 0.8 MB | on demand |
| `es-*` (pdf-lib) | 575 KB | 248 KB | lazy |
| `ocr/` | 22 MB | — | on demand, never precached |

Two observations to verify with a bundle visualiser before acting:

- The engine barrel is imported in 164 places through `'@pdf-editor/engine'`. That makes about
  half a megabyte gzipped of mostly worker-side code part of the full shell's first paint.
- `worker-engine-*` (EmbedPDF's own worker, never loaded) and `browser-module-*` each appear
  twice in `dist/`. They are excluded from the precache or only referenced from workers, so
  they cost disk, not launch time.

---

## 2. Vocabulary (fixes a naming clash)

The owner says "edition" for web, desktop and phone. The code says "edition" for `full` and
`compact`. Proposal:

- **Edition** is the *product* word only, in docs, the About dialog and release names:
  *Recto Web*, *Recto Desktop*, *Recto on phones*.
- **Target** (code: `TARGET`, `__TARGET__`, `RECTO_TARGET`) is the build-time distribution:
  `web` | `desktop`.
- **Shell** (code) is the run-time device UI: `full` | `compact`. At M10 `compact` becomes
  `phone`.
  - When M10 starts, a mechanical rename `Edition` → `Shell` in `edition.ts` and its callers.
  - The `?edition=` parameter, `data-edition` and the session key stay as they are, for
    compatibility (tests and support links use them).
- **Capability** is a run-time fact about the host: what this install can do.
- **Lab flag** is a build-time switch for unfinished work, such as R12's L-1 "Liquid Glass
  union". Lab flags are compiled out of release builds.

---

## 3. Desktop options as of 2026

| | **Installed PWA** (Chromium desktop) | **Tauri 2** | **Electron** |
|---|---|---|---|
| What it is | The web app installed from the browser, in its own window | Rust shell plus the **system webview**: WebView2/Chromium on Windows, WKWebView on macOS, WebKitGTK on Linux | Bundled Chromium plus Node |
| Install size (Recto: ~8 MB of wasm, ~10 MB of JS and CSS, optional 22 MB OCR) | 0 extra | Shell ~3–10 MB, so **~25–45 MB** with our assets | Chromium adds ~80–120 MB to the installer and ~250 MB on disk |
| Open with / file associations | `file_handlers` + `launch_handler` + `launchQueue`: **Chromium only**. Safari "Add to Dock" and Firefox have no file handling *(verify Firefox's 2025–26 Windows web-app work)* | `bundle.fileAssociations` on all three OSes. Single-instance plugin routes a second "open with" to the running window | `electron-builder` file associations, all OSes |
| Save in place, native files | File System Access handles: Chromium only. Elsewhere it is download only | Native fs through `plugin-fs` and `plugin-dialog`, scoped by the capability ACL | Full Node fs (must be fenced off from the renderer) |
| Watch files and folders | `FileSystemObserver`, Chromium, recent *(verify status)*. Only while the window is open | Native watcher (`notify` crate). Can run from the tray | `fs.watch`, chokidar-style |
| **OS keychain for personal data** | **None.** Origin storage is unencrypted at rest in the browser profile and evictable unless `storage.persist()` is granted. WebCrypto with a non-extractable key stored beside the data only obscures it. | Keychain / Credential Manager / Secret Service through the `keyring` crate behind a small command. *(Stronghold plugin exists; verify its v3 deprecation note before choosing it.)* | `safeStorage` (OS-backed encryption), built in |
| Network beyond the origin | The CSP and our promise forbid it | **Rust-side HTTP** (`plugin-http` with URL allowlists per connector). The webview's CSP can stay `connect-src 'self' ipc:`, so page script never reaches the internet | Main process `net`. Renderer CSP is up to us |
| Auto-update | Service worker, already there (prompt flow) | `plugin-updater` with a **mandatory ed25519 signature**. A static `latest.json` on GitHub Releases is enough: no hosted service | `autoUpdater` / electron-updater from GitHub Releases |
| Code signing | None needed | macOS: Developer ID + notarisation (Apple Developer Program). Windows: Authenticode (Azure Trusted Signing or an OV certificate), otherwise SmartScreen warnings. Linux: none (AppImage, deb, Flatpak) | Same as Tauri |
| Security model | Browser sandbox; strongest by default | Capabilities/permissions ACL per window and plugin. No Node in the page. Small native surface | Large surface. Needs `contextIsolation`, `sandbox`, no `nodeIntegration`, and prompt Chromium updates (every ~4–8 weeks) |
| **PDFium wasm** | As today: single-thread wasm in workers, ~2 GiB heap in practice (ADR-0004) | Same wasm in the same workers. Needs `'wasm-unsafe-eval'` in the Tauri CSP. Later option: **native PDFium in a Rust sidecar** (`pdfium-render`) for > 1 GB documents and threads, behind the same engine port | Same wasm. COOP/COEP on a custom protocol allows threads, but PDFium is not thread-safe, so little gain. Native addon possible |
| Engine consistency | Chromium only | **Three engines.** Recto already runs CI on Chromium, Firefox and WebKit, so WebKit risk is tested today. WebKitGTK on Linux is the weakest *(verify GPU/compositing on current distros)* | One Chromium everywhere |
| Phone later | n/a | Tauri 2 also targets iOS and Android (not proposed now) | No |

**Recommendation**

- **D0, which is part of web, not desktop.** On Chromium desktop installs, R12's E22 extras:
  `file_handlers`, `launch_handler`, first ⌘S saves in place, "Changed on disk". Each is detected
  and hidden elsewhere. None of them is a V1 criterion. They are cheap progressive enhancement.
- **D1, after V1: Recto Desktop on Tauri 2.** Reasons:
  - size (~30 MB against ~150 MB),
  - a security model that matches our privacy stance (network in Rust, behind per-connector
    allowlists; a closed page CSP),
  - real keychain storage,
  - a Rust path to native PDFium for ADR-0007's escalation triggers,
  - signed updates from static GitHub Releases, which keeps the "no hosted or metered service"
    rule.
- **Switch to Electron only if** a must-have desktop feature is blocked by WKWebView or
  WebKitGTK and cannot be worked around through Rust. Examples: a rendering bug in our glass
  materials on WebKitGTK that we cannot fix, or a needed API missing from WKWebView. Electron is
  a shell swap: the platform port (§5) keeps it local to `platform/desktop/`.

Desktop-specific pitfalls to plan for:

- **Origin and storage.** Tauri serves from `tauri://localhost` (macOS/Linux) or
  `http(s)://tauri.localhost` (Windows). Web-install data does not carry over. Offer an explicit
  **Export/Import settings, signatures and recipes** file. The stored formats are already
  versioned (1.0 exit criterion).
- **Service worker off on desktop.** Build with VitePWA disabled and no `startServiceWorker()`.
  Updates come from the native updater.
- **OPFS session writer.** `session/opfs-writer.worker.ts` uses OPFS sync access handles.
  Desktop routes session storage through the platform port to native files instead of relying
  on webview OPFS support *(verify WKWebView/WebKitGTK support if kept)*.

---

## 4. The switch system

### 4.1 Build time: target (dead-code eliminated)

```ts
// vite.config.ts (sketch)
const target = (process.env.RECTO_TARGET ?? 'web') as 'web' | 'desktop';
define:  { __TARGET__: JSON.stringify(target), __LAB__: JSON.stringify(process.env.RECTO_LAB === '1') },
resolve: { alias: { '#platform': fileURLToPath(new URL(`./src/platform/${target}`, import.meta.url)) } },
// VitePWA({ disable: VITEST || target !== 'web', ... })
```

- **The `#platform` alias is the main mechanism.** The UI imports
  `import { platform } from '#platform'` and never branches on the target. Each build contains
  exactly one adapter.
- `__TARGET__` is only for the few places that cannot use the port, such as `main.tsx` choosing
  to register the service worker. `if (__TARGET__ === 'desktop') await import('./desktop/register')`
  is removed entirely from web builds.
- **The meta CSP is generated per target** (`privacy/csp.ts` already builds it):
  - **web** keeps `connect-src 'self'` exactly as it is;
  - **desktop** adds only `ipc: http://ipc.localhost`.
  - A unit test pins both.
- Output folders: `dist/` (web, deployed to Pages) and `dist-desktop/` (consumed by
  `src-tauri`, which later lives at `apps/desktop/`).
- **One codebase, no fork.** `apps/desktop/` holds only the Rust shell, `tauri.conf.json`,
  icons and the capability files. Its `frontendDist` points at `apps/web/dist-desktop`.

### 4.2 Run time: shell (existing)

`launchEdition()` stays the single decision. Shells are lazy chunks. At M10 a `phone` shell
replaces `compact` (see `r13/phone-edition.md`). The desktop target always resolves `full`,
because no desktop has a coarse pointer under 600 px. The override still works for tests.

### 4.3 Run time: capabilities

```ts
// src/platform/capabilities.ts (shared type; each adapter fills it once at launch)
export interface Capabilities {
  readonly saveInPlace: boolean;      // web: FS Access handle; desktop: native
  readonly fileLaunch: boolean;       // web: launchQueue; desktop: OS association
  readonly watchFiles: boolean;       // web: FileSystemObserver; desktop: native watcher
  readonly secureStore: boolean;      // desktop only (OS keychain)
  readonly network: 'none' | 'scoped';// web: always 'none' (the promise); desktop: per connector
  readonly bigDocuments: boolean;     // desktop + native PDFium sidecar (later)
  readonly localModels: boolean;      // desktop only
  readonly wakeLock: boolean;         // both, detected
  readonly windowControlsOverlay: boolean;
}
```

- The capabilities are computed once by `platform.capabilities()` and kept in a tiny store.
- **Commands declare `requires`** in `commands/` (for example `requires: ['secureStore']`).
  When a requirement is unmet, the command is **absent** from menus, the palette, the key map and
  Settings search. It is not shown greyed out.
- **Exception: honesty notices (ADR-0007 §5).** Some features *degrade* rather than vanish.
  "Save" on Safari becomes "Save a copy" with a one-line explanation.
- Tests set capabilities directly through a harness helper. No test needs a real Tauri.

### 4.4 Lab flags

`__LAB__` is a build-time constant. It is true in dev and preview builds and false in deploy and
release builds, like the existing `__RENDER_OVERRIDE__`. Lab code is behind
`if (__LAB__)` with a dynamic import, so release bundles never carry it. A lab flag never stands
in for a capability.

---

## 5. Module map

### 5.1 The platform port (new, `apps/web/src/platform/`)

```
platform/
  port.ts            interface Platform { files, store, secure?, net?, launch, updates, window, capabilities() }
  capabilities.ts    the type above + store + `useCapability(name)`
  web/               adapter: today's code moved behind the port
    files.ts         ← files/open-files.ts, files/save.ts, export/deliver.ts, tools/deliver-file.ts
    launch.ts        ← launchQueue consumer (E22)
    updates.ts       ← pwa/register.ts
    store.ts         ← state/safe-storage.ts, IndexedDB handles (recents), OPFS session writer
  desktop/           adapter: Tauri IPC (after V1)
    files.ts, launch.ts, updates.ts, store.ts, secure.ts (keychain), net.ts (connector broker)
```

- **Lint fence (cheap, pre-V1).** Only `files/`, `export/deliver*`, `tools/deliver-file.ts`,
  `pwa/` and `session/` may touch `showOpenFilePicker`, `showSaveFilePicker`, `launchQueue`,
  `navigator.serviceWorker` or OPFS. Later only `platform/web/` may. `@tauri-apps/*` and
  `window.__TAURI__` are allowed only under `platform/desktop/` and `desktop/`.
  - Implementation: ESLint `no-restricted-globals` / `no-restricted-imports` overrides.
  - The fence costs nothing now and makes the later move mechanical.

### 5.2 Classification of `apps/web/src`

| Class | Modules | Rule |
|---|---|---|
| **Core, shared by every target and shell** | `packages/engine`, `packages/document-model`; in the app: `document/`, `history/`, `annotations/` (models, actions, geometry), `forms/`, `redaction/`, `ocr/` (model and run), `export/` (plan and service), `pages/`, `compare/` (runner and model), `convert/`, `text-edit/`, `jobs/`, `session/` (logic), `state/`, `i18n/`, `motion/`, `styles/`, `ui/` primitives | No target branches. Browser APIs only through `#platform` or the existing engine adapters. |
| **Full shell (desktop browser, iPad, Recto Desktop)** | `shell/frame/`, `shell/capsule/`, `shell/sidebar/`, `markup/`, `stage/`, `home/`, sheets (`*SheetHost.tsx`), `settings/` UI | May import core. Never imported by the phone shell. |
| **Phone shell** | `shell/compact/`, later `shell/phone/` | May import core *models and actions*, never full-shell UI. This forces features to keep model and action code apart from their UI, which they mostly do already (`annotations/actions.ts`, `forms/actions.ts`, `redaction/apply.ts`). |
| **Web-target only** | `platform/web/`, `pwa/`, the service-worker part of `privacy/` | Absent from desktop builds. |
| **Desktop-target only** | `platform/desktop/`, `desktop/my-info/`, `desktop/connectors/`, `desktop/watch/`, `desktop/models/`, `desktop/big-docs/` | Reached only through `#platform`'s `registerExtensions()`. Zero bytes in `dist/`. |

### 5.3 Extension points (how desktop features appear without new screens)

`platform.registerExtensions(registry)` runs once at launch. Web registers nothing. Desktop
registers into registries that already exist or are small to add:

- **Settings sections** (`settings/sections.tsx`): "My info", "Connections", "Watched folders",
  "Local models".
- **Commands** (`commands/`): for example "Fill from My info", "Send to …", "Open watched
  folder".
- **Fill providers** (new, tiny interface in `forms/`):
  `suggest(field) → Suggestion[]`.
  - Web: none, so the "Fill from My info" chip never renders.
  - Desktop: My info, keychain-backed.
  - R12 S12's *Make fillable* stays core (web). Only its *My info* half is a provider.
- **Library sources** (`home/`): on desktop, watched folders appear as a source next to Recents.
- **Triage card actions** (R12 E9a): desktop adds rows such as "Fill 6 fields from My info".

The shell and the design language stay identical. Desktop-only rows follow the same specs
(Q-1…Q-14) and carry no "Pro" or "Desktop" badges in the UI.

---

## 6. Where a feature lands

### 6.1 The rule (apply in order; the first match wins)

1. **Persisted identity or secrets** (profiles, personal details for automatic filling, IDs,
   IBANs kept for reuse, API keys, OAuth tokens, certificates' private keys) → **desktop**
   (`secureStore`). The web cannot protect them at rest (§3).
2. **Network beyond the app's own origin** (connectors, cloud storage, AI APIs, RFC 3161
   timestamps, OCSP/CRL, trust lists) → **desktop** (`network: 'scoped'`). The web's
   `connect-src 'self'` and zero-external-requests promise never bend.
3. **A heavy or native component** (local AI models, LibreOffice-class conversion, native
   PDFium for > 1 GB or threads, HEIC decoder, handwriting OCR models) → **desktop**.
   - Web threshold: an on-demand download over about 25 MB, or anything that needs native
     code.
   - Existing exception: OCR language packs (≈22 MB in total, per language, opt-in), which stay
     on web.
4. **OS integration that outlives the window** (folder watching, tray, global shortcuts, OS
   "open with" on every browser) → **desktop**.
   - Chromium-only *in-window* equivalents (launchQueue, FileSystemObserver while open) may
     exist on web as **detected extras**. They never count toward V1.
5. Everything else → **web**. Desktop gets it automatically (superset rule).
   - **V1 vs web-later** is decided by the V1 criteria: fast to build, most useful, most
     professional.
6. **Phone** gets a feature only when the phone spec (M10) names it. The phone is a deliberate
   subset, never a reflow of the desktop.

### 6.2 What may stay stored on web

The web may keep, on the device and wiped by Forget, what the user **explicitly makes inside
Recto**:

- saved signatures, the comment author name, saved colours, presets, recipes, recents,
- session snapshots (ADR-0032).

It may **not** keep structured identity data that the app reuses to fill things automatically,
and it may not keep credentials. That keeps today's shipped features and draws the owner's line
clearly. *Owner decision needed:* confirm that saved signatures stay on web (recommended:
yes; they are user-drawn, explicit, already shipped and expected by iPad users).

### 6.3 Applying the rule (from the R12 roadmap and the old-roadmap inventory)

| Feature | Lands | Why |
|---|---|---|
| R12 S12 **Make fillable** (field detection) | web (V1 candidate if fast, else web-later) | Pure local analysis |
| R12 S12 **My info** autofill, profiles (PERS-1) | **desktop** | Rule 1 |
| API connections (API-1), plugin API with network (M11-2) | **desktop** | Rule 2 |
| LTV, timestamps, OCSP, trust lists (SIG-1); hardware tokens (SIG-3) | **desktop** | Rules 2 and 4 (PKCS#11 has no browser API) |
| Local AI: meaning search (B5), handwriting to text (B18), summarise | **desktop** | Rule 3. Web B9 (the browser's built-in model) stays a later, opt-in web bet with its network caveat stated |
| Watch-folder Inbox (B10) | **desktop** | Rule 4. Web would run only while open, on Chromium |
| Documents > 1 GB, native PDFium (BIG-1) | **desktop** | Rule 3 |
| Office ↔ PDF (CONV-1), DOCX fidelity (CONV-2) | **desktop** | Rule 3. Declined on web |
| R12 E22 native extras (file handlers, launch handler, save in place, Changed on disk) | web extra (Chromium) **and** desktop core | Rule 4 note: detected on web, native on desktop |
| Peek & Return, Fold, Pins, Flashback, page themes, triage card, E-series polish | **web** | Rule 5 |
| OCR (existing), compare, redaction, export, forms fill, signatures (draw/place/validate offline) | **web**, V1 | Core |
| Editable phone UI (M10) | **phone** shell (web target) | Rule 6 |

---

## 7. Keeping the web lean

### 7.1 Budgets (CI-enforced; gzip; measured baselines in §1)

| Budget | Today | Proposed gate | How |
|---|---|---|---|
| Entry `main` | 72 KB | ≤ 80 KB now; target ≤ 60 KB | Size check on `dist/` in CI |
| Full shell launch JS (entry + shell + static deps) | ≈1.05 MB | **≤ 1.1 MB now (no regression), target ≤ 600 KB** after the barrel split | Walk the import graph of `app-*.js` |
| Phone shell launch JS | ≈130 KB | ≤ 160 KB (M10 editable: ≤ 250 KB) | Same |
| Any lazy feature chunk | — | ≤ 150 KB unless listed | Same |
| Desktop bytes in `dist/` | 0 | **0** | Grep for `@tauri-apps`, `__TAURI__` and `desktop/` markers. Fail if found |
| External requests on web | 0 | 0 (existing E17 / CSP test) | Existing |
| Precache | ≤ 4 MB per file (existing) | Plus a total precache ceiling | Workbox manifest sum |

Budgets are **ratchets**: a gate moves only downwards, and a PR that grows a chunk by more than
5 % says why.

### 7.2 Lazy boundaries

- **Already lazy:** shells (`main.tsx`), Settings, OCR, Batch, New signature, Save a copy,
  the sidebar, Changes and the Compare view, pdf-lib (`es-*`), qpdf, OCR assets, and all
  workers.
- **Biggest win, internal and no UI change: split the engine barrel.**
  1. Give `packages/engine` subpath entries: `/types`, `/geometry`, `/client` (already partly:
     `/overlay-geometry`, `/ink-outline`, `/fonts`).
  2. Move the 164 `'@pdf-editor/engine'` imports to the narrowest entry. Most UI files need
     only types and geometry. `import type` is free.
  3. fontkit, pkijs/asn1js, the PDFium host glue and linebreak then load only in workers or on
     first use: text edit for fontkit, signature validation for pkijs.
  4. Add `sideEffects: false` to the engine and document-model `package.json`, if true.
  5. Verify with a visualiser (none is installed; Rolldown's
     `build.rolldownOptions.output` analysis or a size-diff script is enough, so no new
     dependency is needed).
- **Lazy next** (load on first use, prefetch on hover or idle):
  - Compare runner, redaction apply and report, text-edit editor, forms *authoring*
    (Make fillable), the command palette index, the history scrubber, the Pages grid.
  - Preload rule: start downloading on pointer-enter or on keyboard focus of the entry point.
    Respect Save-Data. Never more than one speculative chunk at a time.
- **CSS:** `app.css` is 242 KB raw. Sheet styles already travel with their lazy chunks. Audit
  that tool-specific module CSS travels with its tool too.

### 7.3 Internal speed (no UI change)

These are the owner's "optimise internals, raise quality". Each needs a measurement before and
after:

- **Pre-warm the PDFium worker at idle after first paint.** Today the wasm fetch is on the
  first-document path, and it is 2.1 MB gz on a cold cache.
- **Use streaming compilation** (`WebAssembly.compileStreaming`) and check that it is in use.
  Share one compiled module across the pool's workers (`Module` is transferable) instead of
  compiling per worker.
- **Dedupe the identical worker-side chunks** (`browser-module-*` ×2) where Rolldown allows.
- **Remove the never-loaded `worker-engine-*` chunks** from `dist/`. They are already excluded
  from precache, so this is disk only.

---

## 8. Personal data and security on desktop

- **Keychain holds a key, not the data.**
  1. The desktop generates a random data key and stores it in the OS keychain.
  2. My info, connector tokens and profiles are encrypted with that key (AES-GCM, WebCrypto
     works in the webview) and stored in the app data directory through the port.
  3. Only the Rust side reads the keychain. The page gets decrypt and encrypt *commands*, not
     the raw key, where practical.
- **Forget** wipes the keychain entry and the data directory. The existing Forget wording
  extends to it.
- **Connectors broker** (`desktop/connectors/`):
  - Each connector declares its hosts.
  - The Tauri capability file allows `plugin-http` only for those hosts.
  - Requests happen in Rust, and the page receives results.
  - The PrivacyShield and E17 "Proof, not promise" list every enabled connector and its hosts.
  - Nothing is enabled by default.
- **Tauri ACL:** one window capability with fs scoped to user-picked paths and app data,
  dialog, updater, single-instance, and http (scoped). No shell or process plugins.
- **Updates:** signed (ed25519) `latest.json` on GitHub Releases; prompt before restart (same UX
  as the web's update prompt). Release CI signs and notarises. Secrets live in the repository's
  Actions secrets.
- **Owner actions and costs:** Apple Developer Program membership; a Windows signing route
  (Azure Trusted Signing is the cheapest current path *(verify pricing and eligibility in
  Türkiye)*); an updater key pair kept offline.

---

## 9. PDFium in each target

- **Web and phone:** unchanged (ADR-0004/0011): single-thread wasm, one worker per document
  plus a bounded pool, transferred buffers, about 1 GB per document as the design ceiling.
- **Desktop D1:** the same wasm and workers, so behaviour is identical and tests are shared.
- **Desktop D2 (only on an ADR-0007 trigger):**
  - An `EngineHost` implementation in `platform/desktop/` routes large documents to a native
    PDFium sidecar (Rust, `pdfium-render`) over IPC.
  - The engine API (comlink messages) is the seam, so the UI cannot tell which host served it.
  - Fixture parity tests run both hosts on the same corpus.

---

## 10. Phone edition (shell, not target)

- The phone edition stays on the **web target, same URL**. Shell selection is unchanged.
- M10's editable phone shell is a new lazy chunk. It reuses core models and actions and has its
  own UI. Full-shell components are fenced off by lint (§5.2). Concept: `r13/phone-edition.md`.
- Desktop-only features never appear on phones. A packaged phone app (Tauri 2 mobile or a store
  build) is out of scope until the owner asks for it.

---

## 11. Sequencing

| When | Work | Cost | UI change |
|---|---|---|---|
| **Now, pre-V1** | `__TARGET__` and `__LAB__` defines (web only); lint fence on browser file, update and Tauri APIs; per-target CSP generator with a test pinning web's `connect-src 'self'` | S | none |
| **Now, pre-V1** | Bundle budgets plus the "0 desktop bytes" check in CI (ratchet from today's numbers) | S | none |
| **Now, pre-V1 (perf)** | Engine barrel split; PDFium pre-warm; shared compiled wasm module; lazy-next list (§7.2), each measured | M | none |
| V1 | Owner declares V1 (draft criteria in the integrated roadmap) | — | — |
| **Post-V1, web** | E22 Chromium extras as detected web enhancements | M | small, owner-approved |
| **Post-V1, desktop D1** | `platform/` port (move web code behind it, no behaviour change); `apps/desktop/` Tauri 2 shell; native files, file associations, single instance, updater, signing; settings export and import | L | none (same UI) |
| Desktop D1+ | My info plus fill providers; connectors broker; watched folders | M each | settings rows |
| Desktop D2 (trigger) | Native PDFium sidecar; local models | L | none |
| M10 (owner) | Editable phone shell | L | phone only |

---

## 12. Open questions for the owner

1. **Do saved signatures stay on web?** Recommended: yes (§6.2). My info and profiles go to
   desktop.
2. **The desktop's price and licence stance.** ADR-0007 §4 says the web stays the canonical,
   always-free product. Is the desktop free as well? (This affects nothing technical, but it
   affects signing and store choices.)
3. **The desktop shell choice:** Tauri 2 (recommended) or Electron (bigger, but the same engine
   everywhere).
4. **Linux.** Ship a desktop build for Linux at D1 (WebKitGTK risk), or only macOS and Windows
   first?
5. **Distribution.** Direct download from GitHub Releases only (recommended for D1), or app
   stores later (Mac App Store sandbox and Microsoft Store)?
