# Recto: the unified V1 plan (R13, final)

Date: 2026-10-09 · Tree: `develop` `8a78589` · Status: **proposal for the owner's review.**
Nothing here is decided until the owner accepts it. Once accepted, it replaces `docs/ROADMAP.md`
M9–M11 as the working plan. **Only the owner declares V1.**

**What "V1" means here.** V1 = **Recto 1.0.0, as the owner declares it.** The redesign's old drop
labels "V1 · core use" and "V2 · the look" (redesign.md §11, task #30 "V2 LIVE") are renamed
**redesign phase 1** and **redesign phase 2** everywhere (DOC-3), so the word "V1" has one meaning.

**What this merges:**

- The earlier roadmap: `docs/ROADMAP.md` M1–M11, the M9 "updates after V2" packages parked on
  2026-10-05 (redesign.md §11), ADR-0017's 1.0 exit criteria, and the deferred items in the specs.
  The R13 inventory checked each one against the code.
- The R12 innovation roadmap (`docs/research/innovation-2026-10/ROADMAP.md`), including the owner's
  decisions D-1…D-5 and the calm rules CR-1…CR-9.
- The R13 internals performance audit (bundles, pdf-lib, ink commit).
- The R13 notes on the editions architecture and the phone edition.
- The R13 critique of the first draft. Every finding is applied below.

**How to read the tables.**

- **Edition:** `web-v1` · `web-later` · `desktop` · `phone` · `owner` (§1.3).
- **Value** 1–5. **Risk** L, M or H.
- **Effort** in work packages (WP): S part of one WP · M one WP · L two to four WPs · XL a track.
- **Kind:** `UI` visible · `I` internal, nothing visible · `I*` internal but timing or loading
  could be noticed, so it needs a screenshot or recording.
- **Lanes:** see §4.1. **Ids:** existing ids kept; new ids PF-n (performance), ED-n (edition
  guards), CR-n (calm rules), V1-x (criteria), DT-n (desktop), M10-n (phone), DOC-n (docs).
  Merged items carry every id they absorb.

---

## 0. Summary

1. **V1 is the desktop-browser and iPad web app, working flawlessly and beautifully.** The phone
   stays a read-only reader in V1 and must not regress. The installable desktop edition comes after V1.
2. **The core is built.** The V1 path finishes, hardens and adds spice, in six waves:
   **W0** foundations and fast wins · **W1** consistency and correctness · **W2** look before you
   leap + first-run welcome · **W3** feel · **W4** teaching and polish · **W5** release candidate.
3. **Up to 7 implementers per wave, one per lane, on file-disjoint lanes (§4.1).** Heavy commands
   share `floor(cores/4)` lock slots (1 on today's 4-core machine), and each wave has a QA WP that
   owns e2e runs. Internal performance work runs in the engine lane every wave, with no UI change,
   gated by golden or pixel-exact tests and by before/after numbers.
4. **The biggest single speed win is one import line (PF-1):** editor first load 1,622 → 879 KB
   gzip (−46 %, measured). It ships in W0 with a lint guard and CI budgets.
5. **W0 also ships two visible wins:** receipts on Save (E13) and "see the original" from the
   title-menu eye (S2-1a).
6. **Editions split by a placement rule (§1.2), not by a fork.** Identity data, network beyond
   Recto's origin, mandatory heavy native parts and OS integration → **Desktop**. Everything else
   → **Web**, which Desktop inherits. **Phone** gets only what the phone spec names. **No
   telemetry, in any edition, ever.**
7. **V1 criteria (§2) are a draft in two tiers:** **Must** (27 blocking) and **Should** (reviewed
   at RC). Numbers marked (tbd) are baselined in W0; the owner sets the final values.
8. **Spice (R12 signature moves) in V1:** S2 see the original, S1 Peek & Return, E12 forms that
   pull you to the finish, E13 receipts, E9a triage card, E3 motion that shows what changed.
   **◇ candidates** the owner may cut at the W2 gate: S4 + S3-Q, S8 Flashback, E6b, E8b, S7.
9. **Phone editing starts with a study, not a design (M10-R):** compare real mobile apps,
   prototype **A: two tools + a ＋ picker** and **B: a five-tool rail** on the owner's phone, and
   lean to the minimum. Whether this pilot runs before V1 is the owner's call (O-8).

---

## 1. Editions

### 1.1 The three editions

| Edition | What it is | Promise | When |
|---|---|---|---|
| **Recto Web** (full shell) | Static files on GitHub Pages; optional PWA install; desktop browsers and iPad/Android tablets | Nothing to install, nothing leaves the device, opens in seconds, works offline after the first visit, every core job works in Chromium, Firefox and WebKit up to the stated size ceiling (V1-P13) | **V1** |
| **Recto on phones** (compact shell, ADR-0033) | The same web build; shell chosen at run time by `shell/frame/edition.ts` (coarse pointer and short side < 600 CSS px) | Read-only reader in V1. Later (M10) an editable edition with a touch UI designed from scratch | Read-only in V1; editing on the owner's word |
| **Recto Desktop** (installable, Tauri 2 recommended) | Same UI, same engine in workers, plus run-time capabilities through a `#platform` build alias | Personal data in the OS keychain, file associations, folder watching, network features only through the native side, very large files | After V1 (ADR-0007, M11-1) |

Three independent axes, no fork:

- **Target** (build time): `web` or `desktop`. `#platform` resolves to `src/platform/web` or
  `src/platform/desktop`, so the web build carries zero desktop bytes.
- **Shell** (run time): `full` or `compact`.
- **Capabilities** (run time): save in place, open-with, watch, secure storage, network, large
  documents, local models. A command declares what it needs; a missing capability makes the command
  **absent**, not disabled. A degraded feature (Safari: Save → Save a copy) says why in one line.

### 1.2 The placement rule (first match wins)

1. It keeps **identity data or credentials about the person**: My info, profiles, tokens, API keys.
   → **desktop**. *Data the person makes in Recto* (a drawn signature, presets, recipes, recents,
   snapshots, Flashback) is their own work, not profile data, and stays on the web, on the device,
   opt-in where it is personal (signatures).
2. It needs **any network beyond Recto's own origin**: API connectors, LTV/OCSP/timestamps, cloud
   anything. → **desktop**, only through the native side. Web page code keeps `connect-src 'self'`.
3. It needs a **heavy component that cannot be opt-in and lazily fetched from Recto's own origin**:
   native code, a local model (D-1), or a mandatory download over about 25 MB. → **desktop**.
   (PDFium/qpdf wasm and opt-in Tesseract language packs are lazy, same-origin and therefore web.)
4. It needs **OS integration that outlives the window**: watch folders, file associations, tray.
   → **desktop**.
5. **Everything else → web**, and desktop inherits it. **The phone** gets a feature only when the
   phone spec (M10) names it.

**Standing promises for every edition:** no telemetry, no analytics, no account. Desktop network
features (DT-5, DT-7) are opt-in per service and reverse the old "no hosted services" non-goal
**only for desktop**; DOC-1 states this reversal for the owner explicitly.

**Splits this rule causes:** S12a Make fillable → web; S12b My info → desktop. E25a @ inserter →
web; its My-info row → desktop. E22a detected PWA extras → web; E22b native file handling →
desktop. B5, B18 and alt-text models → desktop, behind D-1.

### 1.3 Edition tags

`web-v1` needed for V1, or cheap and valuable enough to land before it · `web-later` web, V1.x ·
`desktop` installable edition · `phone` editable phone edition (M10) · `owner` only the owner.

### 1.4 Documents to update when this plan is accepted

| Id | Change |
|---|---|
| DOC-1 | `VISION.md`: replace the non-goal "native desktop apps (a Tauri wrapper is a v3 consideration)" with the three-edition promise and the placement rule; restate "no telemetry, ever" for all editions; name the desktop-only reversal of "no hosted or networked services" (owner OK). Map the VISION v1.0 success criteria onto V1-F rows (V1-F0). |
| DOC-2 | New **ADR-0034 "Editions and the placement rule"**, extending ADR-0007 and ADR-0033. |
| DOC-3 | `ROADMAP.md`: mark built M9 rows (D0, most of D1, D2-1…5/7/9/10, D3-1…7, D4-1/2); point M9–M11 at this plan; rename the redesign drops to "redesign phase 1/2"; define V1 = 1.0.0 as the owner declares it. |
| DOC-4 | `docs/specs/redesign.md` §15 "As built", filled per wave (D4-9). |
| DOC-5 | **ADR-0017 amendment:** V1-R2 (owner's daily use for N days) and V1-R7 (independent review + five-person test) replace "two betas and four weeks". |
| DOC-6 | `docs/process/agent-workflow.md`: the concurrency rule of §4.1 (cap 7, heavy slots = floor(cores/4), QA WP per wave), the extended lane-to-folder table and the hot-file list. |
| DOC-7 | `docs/specs/redesign.md` §10.0: the R12 calm rules CR-1…CR-9 written in as rules. |

---

## 2. V1 acceptance criteria: DRAFT for discussion

Rules: every criterion is measurable and automated in CI where possible; **Owner** criteria are
checked by the owner on his devices; **(tbd)** numbers are baselined in W0 and set by the owner.

**Two tiers.** **Must** criteria block V1. **Should** criteria are reviewed at the RC; a miss is
either fixed or explicitly accepted by the owner. The owner discusses the Must list first.

### 2.0 The Must list (27, blocking)

| Id | In one line |
|---|---|
| V1-F1…F12 | Every core job (§2.2) passes its `jobs.spec.ts` case with its press budget on three engines + tablet |
| V1-F15 | Every core job works offline after the first visit |
| V1-P1 | First paint ≤ 120 KB gzip |
| V1-P2 | Editor initial JS within its gate (§2.3) |
| V1-P4 | Zero external requests during any core job |
| V1-P5 | Open → first page ≤ budget (10 pages) |
| V1-A1…A3 | A-gates blocking; axe 0 serious/critical; every core job keyboard-only |
| V1-B1…B3 | No open blocker/major; no wrong status; no edit older than 2 s ever lost |
| V1-X1 | 10 consecutive green CI runs on three engines, flake < 1 % |
| V1-R1, R2, R6 | Owner's UI freeze; N days of owner daily use; **owner says "V1"** |

(F1–F12 = 12, F15 = 1, P = 4, A = 3, B = 3, X = 1, R = 3: 27.)
Everything else in §2 is **Should**.

### 2.1 V1-Q · Quality bar and visual consistency (Should, except where noted)

| Id | Criterion | How it is checked |
|---|---|---|
| V1-Q1 | Q-1…Q-14 hold at 1440×900, 1366×1024, 1180×820 (touch), 820×1180 (touch), light and dark | Q-bar walkers green; screenshot set reviewed by the owner |
| V1-Q2 | One height, radius and icon size per bar class (E1, Q-9) | Q-9 walker |
| V1-Q3 | No dialogs left: every surface that changes the document is a sheet with its `canChange` act and lock banner (D1-8, D1-8b) | Walker finds no `role="dialog"` outside the sheet primitive; every document-changing sheet declares an act |
| V1-Q4 | EN and TR complete; no truncation with the longest strings; no English inside TR | i18n completeness test; pseudo-long-locale pass; the owner reads TR |
| V1-Q5 | Turkish casing correct everywhere (`i→İ`, `ı→I`) | D3-9 lint ban |
| V1-Q6 | At most one transient chip on screen (CR-1) | Chip walker |
| V1-Q7 | **Owner:** zero "mismatched size or feel" notes on two consecutive iPad script runs | §4.9 script |

### 2.2 V1-F · Core flows work flawlessly

Each job is a `jobs.spec.ts` case with a press budget on Chromium, Firefox, WebKit and the tablet
project.

| Id | Job | Budget (presses, proposed) |
|---|---|---|
| V1-F0 | The VISION.md v1.0 success criteria each map to a row below, or are amended in DOC-1 | mapping table |
| V1-F1 | Open: first visit, Open PDFs…, drop, Recents, `?sample` | ≤ 2 |
| V1-F2 | Read: page by pill or scrubber, follow a link and come back, outline, Find next/previous | ≤ 2 per act |
| V1-F3 | Annotate: highlight, pen, note, shape, text box; undo and redo | ≤ 3 per mark |
| V1-F4 | Fill and sign: fill all fields, place a saved signature, save a copy | first signature ≤ 5; saved ≤ 3 |
| V1-F5 | Edit text: change a word, reflow a paragraph, Turkish survives save and reopen | ≤ 4 |
| V1-F6 | Arrange pages: reorder, rotate, delete, insert blank, extract, combine, split | **≤ 5 per act** |
| V1-F7 | Redact and verify: mark, Find sensitive data, apply, save; receipt shows 0 matches | ≤ 6 |
| V1-F8 | OCR a scan, then Find a word that was only in the image | ≤ 4 |
| V1-F9 | Save in place (Chromium), save a copy, compress with honest numbers | 3 first, then 1 |
| V1-F10 | Compare two versions as a place and step through the changes | ≤ 3 to the result |
| V1-F11 | Recover: reload or crash restores the last change and history tail | 0 |
| V1-F12 | Locked files: signed/restricted opens locked; no act changes its bytes; Unlock anyway works | byte-equality |
| V1-F13 | **Owner:** every job once on the iPad (Safari) and once on the laptop, no surprise | owner |
| V1-F14 | Stored formats versioned with migration tests (snapshots, recipes, Recents, presets, signatures, Flashback if shipped) | unit tests |
| V1-F15 | **Offline:** after the first visit, every core job and every lazy surface (Compare, Batch, OCR with a kept pack, TR locale) works with the network blocked; every lazy chunk is precached | offline e2e (PF-17) |

### 2.3 V1-P · Performance budgets

**Bundle and load** (gated in CI by PF-14, which also caps growth at **≤ 1 % per wave** unless the
owner accepts more, per CR-6):

| Id | Budget | Today | Proposed V1 |
|---|---|---|---|
| V1-P1 | First paint JS+CSS gzip | 118 KB | gate ≤ 120 KB; target 100 |
| V1-P2 | Editor initial JS gzip, before the first page | 1,622 KB | **gate ≤ 900 KB after PF-1 (W0).** The final V1 gate is set from PF-2's *measured* delta after PF-1 at the end of W1 (the audit's ≈ −750 KB estimate overlaps PF-1 and is not additive). Working target ≤ 600 KB after PF-2/PF-5/PF-11 |
| V1-P3 | Web build contains desktop code | — | 0 bytes (ED-1) |
| V1-P4 | External requests during any core job | 0 observed | 0, asserted in e2e |

**Speed** (`performance.mark` in e2e; desktop Chromium and a 4× CPU-throttled proxy for a
mid-range iPad):

| Id | Budget (tbd, baselined in W0) | Proposed |
|---|---|---|
| V1-P5 | Open → first page painted, 10-page fixture | ≤ 600 ms desktop; ≤ 1.5 s throttled |
| V1-P6 | Open → first page painted, 500-page fixture | ≤ 1.2 s desktop; ≤ 3 s throttled |
| V1-P7 | Scroll a 200-page document: long animation frames > 50 ms | 0 at rest scroll; ≤ 2 per 10 s while OCR runs |
| V1-P8 | Pen event-to-draw p95 | ≤ 8 ms (today 11–18 ms; 4 ms stays the long-term goal) |
| V1-P9 | Long stroke commit, 500 points | ≤ 50 ms main thread (today 165–230) |
| V1-P10 | Save/export a 100-page document | absolute: ≤ X s desktop, ≤ Y s throttled (X, Y from the W0 baseline after PF-3); bytes identical |
| V1-P11 | Chrome morphs and place transitions | ≤ 240 ms; ≤ 5 % dropped frames on the motion probes |
| V1-P12 | **Owner:** iPad, 2 h, 3 tabs, 300 pages, 400 % zoom | no tab reload |
| V1-P13 | **Web size ceiling:** the largest file the web promises (proposed 2,000 pages or 500 MB) opens and scrolls; beyond it, an honest message that points to the desktop edition when it exists | e2e on a generated fixture |
| V1-P14 | **Memory, automated proxy:** bitmap-cache byte counter (all engines) and `measureUserAgentSpecificMemory` (Chromium) stay under a ceiling over a 300-page scroll | e2e |

### 2.4 V1-A · Accessibility

| Id | Criterion |
|---|---|
| V1-A1 | A-1…A-24 gates **blocking** in CI (D3-9, §10.5). |
| V1-A2 | axe: 0 serious or critical issues on every place and sheet, both themes. |
| V1-A3 | Every core job by keyboard only; focus always visible and returns to its origin. |
| V1-A4 | Reduced motion: every animation has a static or crossfade path (catalogue test). |
| V1-A5 | Forced colours and 200 % zoom: no lost controls. |
| V1-A6 | Every gesture has a visible button twin (WCAG 2.5.1); gesture-table test. |
| V1-A7 | **Owner or tester:** VoiceOver on the iPad over F1, F2, F3, F4, F9; findings fixed. |

### 2.5 V1-X · Cross-engine and devices

| Id | Criterion |
|---|---|
| V1-X1 | Full e2e and unit matrix green on Chromium, Firefox and WebKit for **10 consecutive CI runs**, flake < 1 %. |
| V1-X2 | OCR engine tests in all three engines (M5-b). |
| V1-X3 | Chromium-only extras feature-detected and **absent** elsewhere (a test each). |
| V1-X4 | **Owner:** OM1, OM5, OM6 measured and recorded (XD-2). |
| V1-X5 | Watch: Chromium 153 stored-handle crash rechecked on Chrome 154 (P-6). |
| V1-X6 | **Phone no-regression:** the read-only compact edition passes its smoke e2e at 390×844 and 844×390 (it ships in the same build). |

### 2.6 V1-B · No known bugs

| Id | Criterion |
|---|---|
| V1-B1 | 0 open blocker or major issues; every minor triaged "V1" or "after". |
| V1-B2 | No wrong status anywhere (e.g. unsigned `/Sig` shown as signed, M4-d; a false honesty line, M8-d). |
| V1-B3 | Fuzzed reload/crash/close over 50 random edit sequences never loses an edit older than 2 s. |
| V1-B4 | qpdf wasm rebuild reproducible (P-7). |
| V1-B5 | **Error states:** corrupt, truncated, password-protected, XFA and over-ceiling files each show the right message at the point of failure (fixture per case). |

### 2.7 V1-M · Motion

| Id | Criterion |
|---|---|
| V1-M1 | Every transition comes from `motion/catalogue.ts` and its tokens (lint or test). |
| V1-M2 | Zero animation frames at rest, including the idle Library aura. |
| V1-M3 | Every animation says what happened and where it went (T4). The owner reviews a 60-second recording per wave; the W3 recording doubles as R12's **portfolio cut** (the signature moves on the iPad). |

### 2.8 V1-R · Release (replaces ADR-0017's "two betas, four weeks"; DOC-5)

| Id | Criterion |
|---|---|
| V1-R1 | **Owner:** UI freeze (starts D4-5…D4-9 media and docs). |
| V1-R2 | RC: all Must criteria green, then **N days of the owner's daily use** with no new blocker/major. Proposed N = 14. |
| V1-R3 | Five-person test (XD-1) ran in two sessions (after W2 and after W4) and its decisions are applied. |
| V1-R4 | Docs current: README hero, About v2, DESIGN B1–B15, redesign §15, ROADMAP. |
| V1-R5 | **Owner:** trademark search (P-1) and the Pages redirect (P-2) before any public "V1" word. **Domain:** `erendenizk.github.io/pdf-editor/` (with the P-2 redirect) is the V1 domain unless the owner pulls P-5 in. |
| V1-R6 | **Owner says "V1".** |
| V1-R7 | An independent read-only review agent pass over the RC (code, docs, criteria), findings triaged. |

**V1 does not require:** the editable phone edition, the desktop edition, any `web-later` item, or
the bets.

---

## 3. The unified backlog

Grouped by area; `web-v1` first. A wave tag points to §4.

### 3.1 Foundations: platform, guards, rules

| Id | Title | Ed. | Kind | V | Eff | R | Lane | Depends | Wave |
|---|---|---|---|---|---|---|---|---|---|
| CR-1 + SLOT | Transient-chip slot + walker, **and the pill/chip adornment API** (`registerPillAdornment`) so later lanes never edit `PagePill.tsx` | web-v1 | UI | 4 | S | L | platform | — | W0 (a1) |
| E1 | Q-9 walker + detent token (size scale built, `fce77f1`) | web-v1 | UI | 4 | S | L | platform | — | W0 (a1) |
| CR-2 | Gesture table in the spec + arena tests per recogniser | web-v1 | I | 4 | S | L | platform | — | W0 (a2) |
| CR-3 · D-4 · D-5 | Key map v2 + Turkish-Q layout tests | web-v1 | UI | 4 | M | M | platform | — | W0 (a2) |
| PEN-CHECK | `?pen-check` capture page exporting fixtures | web-v1 | I | 3 | S | L | platform | — | W0 (a2) |
| E15a | Minimal tip engine (caps, first-use naming) | web-v1 | UI | 3 | S | L | platform | CR-1 | W1 |
| CR-5 | Glass budget counted by the glass walker | web-v1 | I | 3 | S | L | platform | — | W1 |
| CR-9 | Storage honesty: snapshots, Flashback and pins share the 500 MB cap; Settings shows each one's size | web-v1 | UI | 4 | S | L | library | — | W2 (before S8) |
| PF-14 · CR-6 | Bundle and start-up budgets in CI (absolute gates + ≤ 1 %/wave growth cap) | web-v1 | I | 5 | S | L | engine | — | W0 |
| ED-1 | `#platform` alias stub + web policy test (CSP `connect-src 'self'`, zero desktop bytes) | web-v1 | I | 3 | S | L | platform | — | W1 |
| ED-2 | Lint fence: browser file APIs only through `platform/web` | web-v1 | I | 3 | S | L | platform | ED-1 | W1 |
| ED-3 | Lab flags compiled out of release builds | web-v1 | I | 2 | S | L | platform | — | W1 |
| D3-9 | A-gates blocking + casing ban + uppercase labels removed (25 files) | web-v1 | UI | 5 | M | L | lead sweep | — | lead lands it right after the W0 merge, before W1 branches are cut |
| §10.5 | M9 exit: `jobs.spec.ts` step counts, A-gates and budgets blocking | web-v1 | I | 4 | S | L | platform | D3-9, PF-14 | W4 |
| E27 | Accessibility label + chrome text size 85–200 % | web-later | UI | 4 | M | L | platform | E1 | V1.x |
| ED-4 | Rename `Edition` → `Shell` in code (`edition.ts`, `size-class.ts`, `input-modality.ts`, `frame-insets.ts`, `ui/sheet/presentation.ts`, `compact-actions.ts`; keep `?edition=`, `data-edition`) | phone | I | 1 | S–M | L | platform | M10 start | M10-0 |

### 3.2 Engine and internals (performance)

All rows are internal (I or I*). **Rule for every perf item:** the PR carries before/after numbers;
the output is gated by an equality, golden or pixel-exact test; a regression on any V1-P budget
reverts the change. Every new lazy chunk is precached (PF-17).

| Id | Title | Ed. | Kind | V | Eff | R | Depends | Wave |
|---|---|---|---|---|---|---|---|---|
| PF-1 | `text-edit/model.ts` value import drags the engine onto the editor path: `import type`, move the constant, `no-restricted-imports` guard (1,622 → 879 KB gz, measured) | web-v1 | I | 5 | S | L | — | W0 |
| PF-3 | pdf-lib in workers: `parseSpeed: Fastest` and a **large finite** `objectsPerTick` (2–5k) or yielding via `MessageChannel`/`scheduler.yield`, to escape the 4 ms timer clamp while keeping progress and cancel. Never `Infinity` | web-v1 | I | 5 | S | L | — | W0 |
| PF-10 | OCR pool `min(4, cores/2)` **only where `navigator.deviceMemory` reports ≥ 8 GB; ≤ 2 when memory is unknown (Safari, Firefox) or on WebKit** | web-v1 | I | 3 | S | L | — | W0 |
| PF-17 | Precache every lazy chunk in the service worker; offline e2e opens every split surface with the network blocked (V1-F15) | web-v1 | I | 5 | S | L | — | W0, re-checked every wave |
| M3-d | e2e for "Save repaired copy" | web-v1 | I | 3 | S | L | — | W0 |
| PF-2 | Light `@pdf-editor/engine/client` subpath; worker configured before the barrel; earlier wasm fetch. Delta **measured after PF-1** | web-v1 | I | 5 | M | M | PF-1 | W1 |
| PF-4 | Stream-compile PDFium; share the compiled `WebAssembly.Module` across the three workers | web-v1 | I | 4 | M | M | — | W1 |
| M2-a | Free text with an embedded Unicode font (today WinAnsi; Turkish ğ ş ı İ at risk) | web-v1 | UI | 5 | M | M | — | W1 |
| M1-b | JPEG EXIF orientation on insert | web-v1 | I | 3 | S | L | — | W1 |
| M1-d | Engine warnings in the export summary in TR | web-v1 | UI | 3 | S | L | — | W1 |
| P-7 | Weekly qpdf rebuild differs from the committed wasm | web-v1 | I | 3 | S | M | — | W1 |
| PF-8 | Bitmap cache sized to the device; trims on hide or memory pressure **to a low-resolution placeholder, never blank** (screenshot check on tab return) | web-v1 | I* | 4 | S | L | — | W2 |
| PF-9 | Visible renders before OCR/search/compare; search batched per 5 pages | web-v1 | I* | 4 | S | L | — | W2 |
| PF-13 | Long-stroke commit: profile the 165–230 ms (only 15–43 ms is `finishInkStroke`), then fix | web-v1 | I | 3 | S | L | — | W2 |
| M8-a | Ink latency: p95 ≤ 8 ms; long tasks per burst; tiled re-render at tiled zoom | web-v1 | I* | 5 | L | M | PEN-CHECK | W2–W3 |
| PF-5 | Slim the PDFium worker start-up script (pdf-lib, fontkit, text-edit, redaction, brotli lazy; ≈ −1 MB) | web-v1 | I | 4 | M | L | PF-2 | W3 |
| PF-6 | Text extraction on the raw path; golden over a corpus **including ligatures, RTL, Type3 fonts and Turkish** | web-v1 | I | 4 | M | M | measure first | W3 |
| PF-7 | One fewer full-page pixel copy per render; pixel-exact gate | web-v1 | I | 3 | M | M | measure first | W3 |
| M8-h | Cheaper glass compositing in the Pages grid with identical pixels | web-v1 | I* | 4 | M | M | — | W3 (**owner OK** if any pixel changes) |
| PF-11 | Split rarely used surfaces out of the 1.2 MB app chunk (Compare, Batch, furniture, signature sheets, convert, scrubber) with idle prefetch, precached | web-v1 | I* | 3 | M | M | PF-1, PF-17 | W4 |
| PF-15 | Hygiene: duplicate or never-loaded worker files, EmbedPDF `worker-engine-*` excluded | web-v1 | I | 2 | S | L | — | any wave |
| MDL-1 · M11 | Breaking change: remove `markDocumentClean` and `VirtualDocument.clean` from `packages/document-model` (used in `workspace.ts`, `state/saved-store.ts`) | web-v1 (hygiene) | I | 2 | S | L | D1-3 merged | W4 (with V1-F14 migrations) |
| PF-12 · ADR-0010 | Load only the active locale (≈ 91 KB gz); switching prefetches; precached | web-later | I* | 2 | M | M | PF-17 | V1.x (W4 only if PF-14 shows the need; owner OK on switch latency) |
| PF-16 | Second read-only PDFium worker on ≥ 8 GB devices | web-later | I | 3 | L | M | PF-9 | V1.x |
| P-6 | Chromium 153 stored-handle crash: recheck on 154 | web-v1 | I | 3 | S | L | Chrome 154 | watch |
| M3-a | qpdf fallback for unusual encryption | web-later | I | 2 | M | M | — | V1.x |
| M3-b | Compression keeps Gray/CMYK; font subsetting | web-later | I | 3 | L | M | — | V1.x |
| M5-c | Signature visual check renders each page once per signature | web-later | I | 2 | S | L | — | V1.x |
| M5-d | Language-pack store: "kept offline" vs cached | web-later | I | 2 | S | L | — | V1.x |
| M8-b | `pointerrawupdate` and Windows Ink | web-later | I* | 2 | M | M | M8-a | V1.x |

### 3.3 Trust, lock and document

| Id | Title | Ed. | Kind | V | Eff | R | Lane | Depends | Wave |
|---|---|---|---|---|---|---|---|---|---|
| E13-c | Receipt **computation**: search over the output bytes, counts per act | web-v1 | I | 5 | S | L | engine | — | W0 |
| E13-u | Receipt **UI** on Save and Save a copy: "3 areas removed · 0 matches remain"; "Saved on this device" | web-v1 | UI | 5 | S | L | frame (`SaveButton`, `export/SaveCopySheet`) | E13-c | W0 |
| M4-d | Unsigned `/Sig` placeholders show as signed after reopening | web-v1 | I | 5 | S | L | forms | — | W0 |
| D1-3 | Lock enforced in `workspace-store.commit()`; engine edits replay their inverse on refusal; X11 shared-page rule. **Merges first and alone in W1** | web-v1 | I | 5 | M | M | platform (state) | — | W1 |
| D1-4a | `signed`/`restricted` lock on open; Unlock popover at the refusing control. Default confirmed by XD-1 session 1 | web-v1 | UI | 5 | M | L | frame | D1-3 | W1 |
| D1-4b | "Open documents locked" setting; Lock in ⌘K; tab glyph | web-later | UI | 2 | S | L | frame | D1-4a, XD-1 | V1.x |
| M8-g | Policy leftovers (Forms panel buttons inert when locked…) | web-v1 | UI | 3 | S | L | forms | D1-3 | W4 |
| E30 | Remove hidden information with a receipt | web-later | UI | 4 | M | L | engine + export | E13 | V1.x |
| E17a | Privacy popover: "How to test: turn on Airplane Mode" + `offline` breath | web-v1 | UI | 3 | S | L | frame | — | W4 |
| E17b | Observed-requests ledger + on-device intelligence panel | web-later | UI | 4 | M | L | platform | E17a | V1.x |

### 3.4 Chrome: frame, capsule, sheets, motion

| Id | Title | Ed. | Kind | V | Eff | R | Lane | Depends | Wave |
|---|---|---|---|---|---|---|---|---|---|
| R11 · task 32 | The owner's iPad notes, remainder: diff merged work against the notes, finish what is open | web-v1 | UI | 5 | M | L | frame + capsule | — | W0 |
| XD-3 · task 28 | Review leftovers. Frame: tablet tab strip (B2), bar heights, focus after open (W0). Library empty state (W0, library). Compact see-through sheets (W4, platform). **History-scrubber dims → pages (W4). Glass seams → frame (W4).** Text preview order → viewer (W4) | web-v1 | UI | 4 | M | L | as listed | R11 | W0, W4 |
| D1-8 | Dialogs → sheets. **pages:** `crop/CropDialog`, `stage/ResizeDialog`, `furniture/FurnitureDialogs`, `stage/OperationDialogs` (+ `OperationDialogFrame`, `operation-dialogs-store`). **forms:** `signatures/SignDialog`, `shell/PasswordDialog`. **library:** `document/DocumentDialogs` (set/remove password, strip metadata). **Decision:** `shell/compact/CompactPassword` stays a compact sheet, checked by V1-X6 | web-v1 | UI | 5 | M | L | pages · forms · library | — | W1 |
| D1-8b | `canChange` act + lock banner wired into the existing sheets: `OcrSheet`, `ApplySheet`, `DocumentInfoSheet`, `BatchSheet` (redesign §11.3 "act half") | web-v1 | UI | 4 | S | L | viewer-compare (OCR, Apply) + library (DocumentInfo, Batch) | D1-3 | W2 |
| E14 | Sheets that grow by step; primary button morphs "Compress → 42 % → Saved 3.1 MB"; honest progress | web-v1 | UI | 4 | M | L | with D1-8 | D1-8, PF-3 | W1 |
| E3 | Stateful glyphs, odometer page pill, undo naming HUD | web-v1 | UI | 4 | M | L | frame | E1 | W1 |
| D1-6a | Pending-marks bar | web-v1 | UI | 4 | S | L | capsule | — | W2 |
| D1-6b | E then Enter for Edit text, discoverable | web-v1 | UI | 3 | S | L | viewer-read | — | W2 |
| BEFORE-SLOT | `BeforeChip` slot in the `ui/sheet/Sheet.tsx` primitive | web-v1 | UI | 4 | S | L | platform (W3 first merge) | — | W3 |
| D1-6c | ContextBar, field and image bars, page menu "Add … here" | web-later | UI | 3 | M | M | capsule | — | V1.x |
| S7 | Capsule as source and sink (drag out to create, throw in to delete, `/` twin). New file only; `dnd/` is owned by pages | **◇** | UI | 4 | M | M | capsule | CR-2, D1-3, W3-b merged | W3 (second half) |
| E3b | Two-finger hold to rewind undo | web-later | UI | 3 | S | M | capsule | CR-2 | V1.x |
| E4 | Minimised capsule replaces hide-on-scroll | web-later | UI | 4 | M | M | capsule + frame | E1 | V1.x |
| S5 | Tip ring and the one puck | web-later | UI | 4 | L | M | ink + frame | CR-2, CR-3 | V1.x |
| D3-8 · T4 | Light (aurora) module, light-event service, Ambient light setting | web-later | UI | 2 | M | L | platform | brand mint stop | V1.x |
| L-1 | Liquid Glass union, lab flag | web-later | UI | 2 | M | H | capsule | ED-3 | lab |
| D4-4 | Polish: empty states, honesty notice, haptics, five-person test decisions | web-v1 | UI | 4 | M | L | several | XD-1 | W4–W5 |

### 3.5 Ink and markup

| Id | Title | Ed. | Kind | V | Eff | R | Lane | Depends | Wave |
|---|---|---|---|---|---|---|---|---|---|
| S2-1a | **See the original**, phase 1a: the title-menu eye hides annotation layers (hold or toggle) | web-v1 | UI | 5 | S | L | frame (title menu) + ink (layer flag) | — | W0 |
| S2-1b | Hold **B** for the same | web-v1 | UI | 4 | S | L | ink | CR-3 | W1 |
| E2 | Ink strip, one tier: R11 leftovers (knob tracks pointer, no repeated colour, preset long-press menu) | web-v1 | UI | 4 | S | L | ink | R11 | W1 |
| M2-c | Arrow-key nudge (Shift = 10 pt) | web-v1 | UI | 3 | S | L | ink | — | W1 |
| S4 | Scratch to erase, loop to select (D-3: threshold, preview before commit, one-step undo, near-miss fixtures) | **◇** | UI | 5 | M | M | ink | CR-2, PEN-CHECK | W3 |
| S3-Q | QuickShape: a held stroke becomes a real PDF shape, Edit-shape chip | **◇** | UI | 4 | M | L | ink | S4, Polygon/PolyLine check | W3 |
| M8-f | Lasso and eraser: live cut preview | web-v1 | UI | 3 | S | L | ink | — | W3 |
| M8-f-b | Stamp rotation, stroke widths on resize, highlighter erase filter | web-later | UI | 2 | M | L | ink | — | V1.x |
| S3-S | Page-aware snapping + measure (detector in the worker) | web-later | UI | 5 | L | M | ink + engine | S3-Q | V1.x (first) |
| E18 | Ink comfort: Steady smoothing, spring-loaded tools, two-tool swap | web-later | UI | 4 | M | L | ink | E2, M8-a | V1.x |
| E20 | Copy/paste style, select similar, colour meanings, roles | web-later | UI | 4 | M | L | ink | E2 | V1.x |
| S11 | Linked Repeat across pages | web-later | UI | 4 | L | M | ink | — | V1.x |
| S6 | Writing loupe | web-later | UI | 4 | L | M | ink | S3-S | V1.x |
| E19 | Study pack: tape, recall, laser, nib | web-later | UI | 3 | M | L | ink | — | V1.x |
| M2-b | Stamp opacity without a post-pass | web-later | I | 2 | S | L | engine | — | V1.x |
| M2-d | Undoing delete of an imported annotation loses custom appearances | web-later | I | 2 | M | M | ink | — | V1.x |
| M8-c | Tag dots at full chroma | drop | — | — | — | — | — | superseded by D3-2 | — |

### 3.6 Reading, viewer, compare, text edit

| Id | Title | Ed. | Kind | V | Eff | R | Lane | Depends | Wave |
|---|---|---|---|---|---|---|---|---|---|
| S1-1 | **Peek & Return**: link peek, back stack (Z / Shift+Z), Back chip, peek-scrub registered into the pill slot | web-v1 | UI | 5 | M | L | viewer-read | CR-1 slot, CR-3 | W2 |
| S2-2 | See the original, phase 2: source render for text edit, crop, redaction; Shift+B wipe; Before chips through the sheet slot | web-v1 | UI | 5 | M | M | viewer-read (+ one prop per sheet at integration) | S2-1, D1-8, BEFORE-SLOT | W3 |
| D2-6 · M5-a | **Compare as a place**: full screen, chooser (incl. "the file as opened"), Changes list, Compare bar, J/K | web-v1 | UI | 5 | L | M | viewer-compare + capsule (bar) | — | W2 |
| M5-b | OCR engine tests in Firefox and WebKit | web-v1 | I | 4 | S | M | viewer-compare | — | W0 |
| M8-i | `4` announces in Compare; Compare's second file in Recents; a flaky timing test | web-v1 | UI | 3 | S | L | viewer-compare | — | W0 |
| M8-d-a | Text edit: IME window at the caret; false honesty line for full fonts | web-v1 | UI | 4 | S | M | viewer-read (`text-edit/`) | — | W4 |
| M8-e | Real Word and LibreOffice exports in the text-edit corpus | web-v1 | I | 4 | S | L | viewer-read | — | W4 |
| M8-d-b | Join/Split hidden, ligatures as two glyphs, other leftovers | web-later | UI | 3 | M | M | viewer | — | V1.x |
| S2-3 | Changes lens | web-later | UI | 4 | M | M | viewer | S2-2, D2-6 | V1.x |
| S1-2 | Citation peek and skim | web-later | UI | 4 | M | M | viewer | S1-1 | V1.x |
| E11 | Page themes (Paper, Sepia, Night) | web-later | UI | 5 | M | M | viewer + engine | — | V1.x (early) |
| S10 | Pins: floating references | web-later | UI | 4 | M | L | viewer | S1-1 | V1.x |
| E23 | Reading ruler and focus; Listen with on-device voices | web-later | UI | 3 | M | L | viewer | — | V1.x |
| E29 | Performance mode | web-later | UI | 3 | M | L | viewer | — | V1.x |
| S9 | Fold and Fold to marks | web-later | UI | 4 | XL | M | viewer | — | V1.x (late) |
| B19 | RTL in text boxes, Find and text edit | web-later | UI | 3 | L | M | viewer | — | V1.x |

### 3.7 Pages and the light table

| Id | Title | Ed. | Kind | V | Eff | R | Lane | Depends | Wave |
|---|---|---|---|---|---|---|---|---|---|
| E6a | Grid selection: lift, rim glow, fixed badge under virtualisation, headers and tags (what `56ed983` and R11 left) | web-v1 | UI | 5 | S | L | pages | R11 | W0 |
| E6b | Drag ghosts with counts, spring-loaded targets, **Review pages** pass (← → X P); pages owns `dnd/` | **◇** (brackets later) | UI | 4 | M | L | pages | CR-3 | W3 (first half) |
| E28 | Paper templates + note column | web-v1 (cheap) | UI | 3 | S | L | pages | — | W3 |
| E7 · M4-b | Edit the outline to move pages; outline from headings | web-later | UI | 4 | M | M | pages + viewer | — | V1.x |
| E5 | Pinch-scrubbed page ↔ grid | web-later | UI | 4 | L | M | pages | E6b | V1.x |
| E26 | Drag pages out of the window / Share | web-later | UI | 3 | M | M | pages | — | V1.x |
| E24 | Scan tools | web-later | UI | 3 | L | M | pages + engine | S2-2 | V1.x |
| M1-a · M1-c · M4-c · NUP | Deeper split levels; form-field warning on duplicates; trim to content; N-up and booklet | web-later | UI | 2–3 | S–M | L–M | pages | — | V1.x |

### 3.8 Forms and signatures

| Id | Title | Ed. | Kind | V | Eff | R | Lane | Depends | Wave |
|---|---|---|---|---|---|---|---|---|---|
| E12 | **Forms that pull you to the finish**: required ring (pill slot), next-empty stepping (`enterkeyhint=next`), finish bloom, "Ready to sign", signature ink-in | web-v1 | UI | 5 | M | L | forms | E3, CR-1 slot | W2 |
| S12a | Make fillable | web-later | UI | 5 | M | M | forms | S3-S detector | V1.x |
| S12b · PERS-1 | **My info** cards (TCKN, IBAN validated) + fill from My info | **desktop** | UI | 4 | M | M | forms | DT-3 | DT |
| E25a | Make room, @ inserter, `;date`, EN/TR smart dates | web-later | UI | 3 | M | L | forms + ink | — | V1.x |
| M4-a | `/Tabs`, push-button actions, fields on duplicated pages | web-later | I | 2 | M | M | forms | — | V1.x |
| CERT | Certification signatures; signing encrypted files | web-later | UI | 3 | L | M | forms | — | V1.x |

### 3.9 Library, session, onboarding, commands

| Id | Title | Ed. | Kind | V | Eff | R | Lane | Depends | Wave |
|---|---|---|---|---|---|---|---|---|---|
| E8a | Library phase 1 remainder: privacy popover fits the iPad viewport. **First confirm against what R10/R11 built in `home/`**; if done, the WP closes it in an hour | web-v1 | UI | 4 | S | L | library | R11 | W0 |
| E9a · D4-3 | **Triage card** (grown from the facts chip): "2 signature fields · 14 fields · pp. 4–7 scanned (OCR?)", each line a button | web-v1 | UI | 5 | M | L | library + frame title | CR-1 | W1 |
| WEL-1 | **First-run welcome (lean):** first visit lands on a calm welcome in the Library, one "Try the sample" path, three first-use tips via E15a, the triage card on the sample. No tour, no modal; skippable; never shown twice | web-v1 | UI | 5 | S–M | L | library + platform (`sample/`) | E15a, E9a | W2 |
| E16 · D4-2 | Full teaching: self-ticking sample, errors at the fingertip, empty states built from the document | web-v1 | UI | 5 | M | L | platform (`sample/`) + viewer | WEL-1 | W4 |
| S8 | **Flashback** (7 days) + pinned versions; Safari honesty (D-2) | **◇** | UI | 5 | L | M | library (`session/`) | D2-6, CR-9 | W3 |
| E8b | Library phase 2: exact resume, progress arc, draft dot, provenance glyphs | **◇** | UI | 4 | M | L | library | — | W4 |
| E15b | Shortcut coaching, `?` overlay, What's new | web-later | UI | 3 | M | L | platform | E15a | V1.x |
| D2-8 · E10 | ⌘K v2 | web-later | UI | 4 | M | M | platform | — | V1.x (first) |
| E21 | Notes out (Markdown from Review) | web-later | UI | 4 | S | L | viewer | — | V1.x (early) |
| E31 · M11-4 | Markup out and in (XFDF) | web-later | UI | 4 | M | L | ink + engine | E20 | V1.x |
| E32 · E34 | Calibrated measure; accessibility checker | web-later | UI | 3–4 | M–L | M | ink / engine + viewer | — | V1.x |
| E9b · E33 | Library search, smart collections, duplicates; Quick Look and folders | web-later | UI | 4 | L | M | library | E8b | V1.x |
| E22a | Installed-PWA extras (Wake Lock, shortcuts, WCO; detected) | web-later | UI | 2 | S | L | platform | — | V1.x |
| E22b | File handlers, "changed on disk": native | **desktop** | UI | 3 | M | L | platform/desktop | DT-1 | DT |
| TABLE · BATCH-R · COW · EXT | Table extraction; redaction in batch recipes; copy-on-write sources; browser extension | web-later | — | 2–3 | M–L | M | engine | — | V1.x |
| SIDE | Tablet side dock, decided together with E4 | web-later | UI | 2 | M | M | capsule | E4 | V1.x |

### 3.10 Release, brand, docs, owner steps

| Id | Title | Ed. | V | Eff | Depends | Wave |
|---|---|---|---|---|---|---|
| XD-1 | Five-person test. **Session 1 after W2** (lock default, Peek, Compare, welcome). **Session 2 after W4** (teaching, polish) | owner · web-v1 | 5 | M | W2, W4 builds | W2→W3 gap; W4→W5 gap |
| XD-2 | Owner measurements OM1, OM5, OM6 | owner | 4 | S | W3 build | W4–W5 |
| D4-5 | Media scenes re-recorded, both themes | web-v1 | 3 | M | freeze | W5 |
| D4-6 | README hero and screens | web-v1 | 3 | S | freeze | W5 |
| D4-7 | About page v2 | web-v1 | 3 | M | freeze, owner's mark | W5 |
| D4-8 | Brand: **app icons, manifest colours**, social card, wordmark, `TRADEMARKS.md` | web-v1 | 3 | S | owner artwork | W5 |
| D4-9 · DOC-3 · DOC-4 | Docs: DESIGN B1–B15, redesign §15, ROADMAP | web-v1 | 4 | M | each wave appends | W1–W5 |
| DOC-1 · 2 · 5 · 6 · 7 | VISION, ADR-0034, ADR-0017 amendment, agent-workflow, calm rules | web-v1 · owner OK | 4 | S | plan accepted | W0 |
| P-1 | Trademark search for RECTO | owner | 5 | — | before public V1 | before W5 |
| P-2 | `ErenDenizK.github.io` with the `/pdf-editor/` redirect | owner | 4 | — | — | any time |
| P-3 | Repository description, topics, social preview | owner | 2 | — | D4-8 | W5 |
| P-4 | Release PR and tags, only on the owner's word | owner | — | — | V1-R2 | W5 |
| D4-10 | Press kit `/recto/about/press/` + **zip per release** | web-later | 2 | M | V1 | V1.x |
| D4-11 | Case study v1 | owner · web-later | 3 | M | V1 | V1.x |
| P-5 | Custom domain (pull into V1 only if the owner wants it before the public word) | owner · web-later | 2 | — | — | V1.x |
| P-8 · brand phase 4 | Turkish About, light-theme README images, tour video, **phone captures, case study v2** | web-later | 2 | M | D4-5…7 | V1.x |

### 3.11 Bets (after V1; the owner picks)

| Id | Bet | Edition |
|---|---|---|
| B1 | Text view (local reflow) | phone (M10-6), later web |
| B2 | Compose in Compare | web-later |
| B3 | Branching time strip | web-later |
| B4 | Audio-synced markup | web-later |
| B5 | Meaning search with cited passages (model, D-1) | desktop |
| B6 | Merge markups via a sidecar op log | web-later |
| B7 | Replay | web-later |
| B9 | Browser built-in translate/summarize | web-later (Chromium-only, hidden elsewhere) or desktop |
| B10 | Watch-folder Inbox | desktop |
| B11–B16 | Tidy handwriting, Auto Trace signature, Document health lane + Tape view, Threads, Excerpt Shelf, Alternates | web-later |
| B17 | Split read view, multi-window | web-later / desktop |
| B18 | Ink to text, handwriting search (model) | desktop |

---

## 4. The V1 path

### 4.1 How the waves run

**Concurrency (replaces the old three-agent cap; DOC-6).**

- Up to **7 implementer WPs per wave**, one per lane, plus **one QA WP** that owns e2e runs and
  test files. Planning and review agents only read and do not count.
- **Heavy commands** (`pnpm build`, Playwright, the full unit suite) go through `tools/dev/heavy.sh`
  with **floor(cores/4) slots**, measured on the machine (1 slot on today's 4 cores). Implementers
  run light checks (format, lint, typecheck, focused vitest with `--maxWorkers=1`) and hand e2e to
  the QA WP's queue. Typecheck, lint and build never run at the same time as vitest.
- Firefox and WebKit run in CI. Locally: Chromium plus the tablet project for touched specs.

**Lanes own folders, not intentions.** Every WP brief lists its real file paths.

| Lane | Owns |
|---|---|
| frame | `shell/frame/` (except `PagePill.tsx` internals after the slot lands), title menu, `export/SaveCopySheet` UI |
| capsule | `shell/capsule/`, `annotations/AnnotationBar`, `annotations/ReadSelectionBar` |
| ink | `markup/`, `annotations/` **minus** `AnnotationBar` and `ReadSelectionBar` (incl. `lasso/`, `eraser.ts`, `AnnotationLayer.tsx`, `pen/`) |
| pages | `stage/grid/`, `stage/*Dialog*`, `stage/OperationDialogFrame.tsx`, `operation-dialogs-store.ts`, `crop/`, `furniture/`, `pages-sheets/`, `dnd/` |
| viewer-read | `viewer/`, `stage/ReadView*`, `shell/sidebar/`, `text-edit/` |
| viewer-compare | `compare/`, `ocr/` |
| library | `home/`, `session/`, `document/`, `sample/` (W2 only, with platform's agreement) |
| forms | `forms/`, `signatures/`, `shell/PasswordDialog.tsx` |
| engine | `packages/engine`, `workers/`, `redaction/` internals, `export/` computation (internal only, no UI) |
| platform | `commands/`, `ui/`, `styles/`, `motion/`, `state/`, `platform/` |

**Hot files** are append-only (one-line edits), merged by the integrator: `keymap.ts`,
`commands/registry.ts`, `app-commands.ts`, `en.json`/`tr.json`, `tokens.css`, `materials.css`,
`motion/catalogue.ts`, `capsule-morph.ts`, `app.tsx`, `shell/AppShell.tsx`,
`state/workspace-store.ts` (outside D1-3), `ui/sheet/Sheet.tsx` (outside BEFORE-SLOT). The
integrator runs `pnpm --filter @pdf-editor/web i18n` once per merge.

**Merge order:** platform first, then the other lanes, then the engine. The lead runs the full unit
suite and the touched e2e once on the merged result, then pushes. A red merge is fixed first by a
fix agent while new WPs keep running. **Sweeps** (D3-9) are landed by the lead right after a wave's
merge, before the next wave's branches are cut.

**Every WP delivers:** EN/TR strings; tests; screenshots at 1440×900 and 1180×820 (touch); its
lazy-load boundary, precache entry and bundle delta; before/after numbers for any perf claim; a
spec citation in doc comments; Conventional Commits.

**Every wave ends with:** a deploy from green `develop`; a 60-second recording; the bundle check;
the offline e2e; the owner's iPad task script with timings; go or no-go.

**◇ drop rule:** a ◇ item that misses its W3 acceptance is cut from V1, with no extension. S7 is the
first to drop under time pressure.

Marks: **(I)** internal · **(OK?)** owner OK before anything visible changes · **★** spice ·
**◇** V1 candidate.

### 4.2 W0 · Foundations and fast wins

Goal: lock in the measured speed gains, lay the shared rules, close the owner's iPad notes, and
ship two visible wins.

| WP | Lane | Scope | Acceptance |
|---|---|---|---|
| W0-a1 | **platform** (merges first, small) | CR-1 chip slot + **pill adornment API**; E1 Q-9 walker and detent token; chip walker | Walkers in CI; a test registers an adornment without touching `PagePill.tsx`; no visible change except tokens |
| W0-a2 | **platform** (parallel, merges second) | CR-3 key map v2 with TR-Q tests; CR-2 gesture table and arena tests; PEN-CHECK | Keymap tests pass on EN-US and TR-Q; capture page records pressure, tilt, time on iPad Safari |
| W0-b | **engine (I)** | PF-1 + guard; PF-3 (finite ticks); PF-10 (memory-aware); PF-14 budgets + growth cap; PF-17 precache + offline e2e; **E13-c**; M3-d | Editor ≤ 900 KB gz; saved bytes identical; cancel arrives < 100 ms; OCR text identical at pool 1/2/4; budgets fail CI; V1-P1/P2/P5/P6/P10 baselined |
| W0-c | **frame + capsule** | R11 remainder (strip pieces, Save pill, privacy/⋯ piece, dock ⇄ palette morph); XD-3 frame items; ★**E13-u** receipts; ★**S2-1a** see the original from the title-menu eye | Owner notes closed for these pieces; morph probes green; receipt reads from E13-c; eye restores on `pointercancel` |
| W0-d | **pages** | E6a selection | Badge survives virtualisation; mixed-aspect grid aligned |
| W0-e | **library** | E8a (confirm first); Library empty state | Popover inside 1180×820 and 820×1180 |
| W0-f | **forms + viewer-compare** | M4-d; M8-i; M5-b | Reopen fixture shows "unsigned"; OCR tests green in three engines |
| W0-q | **QA** | `jobs.spec.ts` skeleton for V1-F1…F12 (report-only); phone smoke at 390×844 (V1-X6); error-state fixtures (V1-B5) | Report on every merge |

**After the merge:** the lead lands the D3-9 sweep, then cuts W1 branches. **Docs:** DOC-1, 2, 5,
6, 7 once the owner accepts the plan.
**Owner script:** "Library → sample → Markup → Pages → Library on the iPad; note any size mismatch.
Tap the eye. Redact a word, save a copy, read the receipt."

### 4.3 W1 · Consistency and correctness

Goal: every surface behaves the same, nothing lies, Turkish is right.

| WP | Lane | Scope | Acceptance |
|---|---|---|---|
| W1-a | **platform (state)** — merges **first and alone** | D1-3 lock in `commit()`; ED-1, ED-2, ED-3; CR-5; E15a | Every committing act refused on a locked document (test per act family); byte-equality on locked save. Other W1 briefs forbid touching `commit()` |
| W1-b | **frame** | D1-4a lock on open + Unlock popover; ★E3 glyphs, odometer pill, undo HUD | One glyph animates at a time; zero frames at rest; V1-F12 passes |
| W1-c | **pages** | D1-8: `CropDialog`, `ResizeDialog`, `FurnitureDialogs`, `OperationDialogs` → sheets, ★E14 reporting buttons | Walker finds no dialog in pages folders; honest progress from PF-3 |
| W1-d | **forms** | D1-8: `SignDialog`, `shell/PasswordDialog` → sheets (E14 pattern) | As W1-c |
| W1-e | **library** | ★E9a triage card; D1-8: `document/DocumentDialogs` → sheet | Facts < 200 ms after first render; one card per open; obeys the chip rule |
| W1-f | **ink** | S2-1b hold B; E2 remainder; M2-c nudge | Swap < 50 ms; restores on `pointercancel`; no repeated colour |
| W1-g | **engine (I)** | PF-2 (delta measured after PF-1, sets the V1-P2 gate); PF-4; M2-a; M1-b; M1-d; P-7 | `worker-configured` earlier (marks); Turkish free text round-trips in Acrobat, pdf.js, PDFium |
| W1-q | **QA** | e2e queue; V1-F12 byte tests; dialog walker | — |

Mount points in `app.tsx` and `AppShell.tsx` are one-line hot-file edits merged by the integrator.
**Owner script:** "Open the signed fixture: locked, reason shown where I tapped. Crop a page: a
sheet. Hold B. Type ğüşıöç İ in a text box, save and reopen."

### 4.4 W2 · Look before you leap + first welcome

Goal: navigation without fear, Compare as a real place, forms that finish themselves, and a first
visit that feels designed.

| WP | Lane | Scope | Acceptance |
|---|---|---|---|
| W2-a | **viewer-read** | ★S1-1 Peek & Return (peek-scrub via the pill slot); D1-6b | Peek < 120 ms warm / < 300 ms cold throttled; Back restores scroll ±2 px and zoom; stack in snapshot |
| W2-b | **viewer-compare + capsule (bar)** | D2-6 + M5-a Compare place; D1-8b for `OcrSheet`, `ApplySheet` | V1-F10 in ≤ 3 presses; both files in Recents |
| W2-c | **forms** | ★E12 (ring via the pill slot) | Ring correct through undo; reduced motion shows text |
| W2-d | **engine (I*)** | PF-8 (low-res placeholder); PF-9; PF-13 profile | V1-P7 passes; screenshot on tab return shows no blank page |
| W2-e | **ink (I*)** | M8-a part 1 | p95 trending to ≤ 8 ms on `ink-latency.spec.ts` |
| W2-f | **library** | ★**WEL-1** first-run welcome; CR-9 storage honesty; D1-8b for `DocumentInfoSheet`, `BatchSheet` | First visit → sample → first mark in ≤ 3 presses; never shown twice; sizes shown in Settings |
| W2-g | **capsule** (after W2-b's bar merges) | D1-6a pending-marks bar | Bar shape in the morph; zero layouts |
| W2-q | **QA** | e2e queue; offline re-check of new chunks | — |

**After W2: XD-1 session 1** (lock default, Peek, Compare, welcome) and the **◇ decision gate**:
the owner confirms or removes each ◇ for W3.
**Owner script:** "Follow 'see Fig. 2' and come back (< 3 s). Compare with the file as opened.
Fill the form to the finish and sign. Clear site data and open Recto as a stranger."

### 4.5 W3 · Feel: ink, pages, the safety net

| WP | Lane | Scope | Acceptance |
|---|---|---|---|
| W3-a0 | **platform** (first merge) | BEFORE-SLOT in `Sheet.tsx` | Sheets render a Before chip from one prop |
| W3-a | **ink** | ◇S4, then ◇S3-Q; M8-f; M8-a part 2 | 0 false scratches, ≥ 95 % recall on the owner's fixtures; preview before commit; one-step undo; QuickShape needs the hold |
| W3-b | **pages** (first half) | ◇E6b ghosts, spring-loaded targets, Review pages pass; E28 | One undo step per act; pass keys scoped in `SHARED_KEYS` |
| W3-c | **library (session)** | ◇S8 Flashback + pinned versions (open in Compare) | Capture ≤ 8 ms; redaction exclusion test; Safari notice and eviction tests; counted by CR-9 |
| W3-d | **capsule** (second half, after W3-b merges) | ◇S7 source and sink, new file using pages' `dnd/` API | All creation through `commit()` and `canChange`; locked → shake; `/` twin |
| W3-e | **viewer-read** | ★S2-2 source render, Shift+B wipe, Before chips (one prop per sheet, landed at integration) | Original < 150 ms after first render; one `BeforeChip` |
| W3-f | **engine (I)** | PF-5; PF-6 (corpus with ligatures, RTL, Type3, Turkish); PF-7; M8-h (**OK?**) | Goldens deep-equal; pixel diff 0; V1-P budgets tightened |
| W3-q | **QA** | e2e queue | — |

**Owner script:** "Scratch out a word; draw a box and hold. Drag pages 3–5 after 8; delete page 2,
close without saving, bring both back from Flashback. Drag a note out of the capsule."
The W3 recording is the **portfolio cut**.

### 4.6 W4 · Teaching and polish

| WP | Lane | Scope | Acceptance |
|---|---|---|---|
| W4-a | **platform** | ★E16 full teaching; §10.5 exit gates blocking; XD-3 compact see-through sheets | ≤ 1 tip per session; each hint once per file per act |
| W4-b | **library** | ◇E8b | Resume ±2 px |
| W4-c | **viewer-read** | M8-d-a; M8-e; XD-3 text preview order | Corpus round-trips; IME on macOS and iPad |
| W4-d | **frame** | E17a; XD-3 glass seams; D4-4 polish (frame part) | Review list closed for frame |
| W4-e | **pages + forms** | XD-3 history-scrubber dims (pages); M8-g (forms) | Review list closed |
| W4-f | **engine (I*)** | PF-11 with idle prefetch, precached; PF-15; MDL-1; PF-12 only if PF-14 shows the need (OK?) | No first-open flash; V1-P2 gate met or the gap explained |
| W4-q | **QA** | V1-B3 fuzz; V1-F14 migrations; V1-A3 keyboard runs; V1-A2 axe; V1-P13 ceiling; V1-P14 memory | Green, or bugs filed into W5 |

**Owner:** XD-2 measurements on this build. **After W4: XD-1 session 2.**

### 4.7 W5 · Release candidate

- Apply XD-1 session 2 decisions (D4-4).
- **Bug bash** on three engines plus the owner's iPad; fix WPs per lane, up to 7 in parallel.
- **V1-X1:** 10 consecutive green CI runs. **V1-R7:** independent review agent pass.
- **V1-R1** freeze → D4-5, D4-6, D4-7, D4-8, D4-9, P-3.
- **RC deploy**, then V1-R2: N days of daily use.
- **Owner:** P-1, P-2, then **"V1"** (V1-R6); P-4 release PR and tags.

### 4.8 Items that run beside any UI wave

Internal, equality-gated, no UI change: PF-1, PF-3, PF-10, PF-14, PF-17 (W0) · PF-2, PF-4, M1-b,
P-7 (W1) · PF-8, PF-9, PF-13 (W2) · PF-5, PF-6, PF-7 (W3) · PF-11, PF-15, MDL-1 (W4) · M8-a
(W2–W3) · M3-d, M5-b, M8-e (tests) · D1-3, ED-1, ED-2, ED-3.

Need the owner's OK if they change pixels or behaviour: **M8-h**, **PF-12**, any automatic glass
downgrade on slow devices, **E4** proposed as a performance fix.

### 4.9 The owner's V1 task script (cumulative; iPad and laptop)

1. Open the sample from the Library. Go to page 3 by the pill, follow a link and come back.
2. Highlight a sentence. Write with the pen, then scratch it out. Hold B.
3. Fill the form fixture to the finish and sign with a saved signature.
4. Edit a word in the letter, including Turkish characters.
5. Reorder pages in the grid, then delete one and bring it back.
6. Redact an IBAN, save a copy, and read the receipt.
7. OCR the scan and Find a word from the image.
8. Compare with the file as opened.
9. Reload the browser. Everything is back.
10. Turn on Airplane Mode and repeat steps 2 and 8.

Timings are recorded every wave.

---

## 5. After V1

### 5.1 V1.x: the rest of the web

1. **V1.x-1 "Ink that knows the page":** S3-S, then S12a; E11, E21, D2-8/E10.
2. **V1.x-2 "Pages and power":** E7 + M4-b, E5, E26, S11, E20, E18, E4 with SIDE, S5.
3. **V1.x-3 "Trust and study":** S2-3, E30, E17b, E31, S10, S1-2, E23, E19, E15b, D1-4b, D1-6c.
4. **V1.x-4 "New groups":** E29, E32, E34, E24, E25a, E9b, E33, S6, S9, B19, TABLE, NUP, CERT,
   BATCH-R, COW, EXT, M-series leftovers, PF-12, PF-16, E27, E22a.
5. **Bets,** chosen by the owner.

### 5.2 Desktop edition track (DT)

Starts after V1, on the owner's word. Tauri 2 recommended; Electron only if a platform's built-in
engine blocks a must-have.

| Id | Item | Effort | Notes |
|---|---|---|---|
| DT-0 | Platform refactor: `src/platform/{web,desktop}`, capability registry, commands declare needs, session storage behind an interface | L | No UI change; begins with ED-1/ED-2 in W1 |
| DT-1 | Tauri shell: windows, open-with, save in place everywhere, signed auto-updates from GitHub Releases, service worker off, CSP adds only the native channel | L | M11-1, ADR-0007 |
| DT-2 | Data bridge: export/import of web data (signatures, presets, recipes, recents) | M | Storage does not share |
| DT-3 | **My info** and profiles in the OS keychain (S12b, PERS-1); fill provider hook; @ inserter row | M | Rule 1 |
| DT-4 | Native file watching, "Changed on disk", folder Inbox (E22b, B10) | M | Rule 4 |
| DT-5 | Network signatures: LTV, RFC 3161, OCSP, trust lists, via the native side, opt-in | L | Rule 2 |
| DT-6 | Hardware tokens and smart cards | L | |
| DT-7 | API connections (opt-in per service, keys in the keychain) | L | Rule 2; "much later" |
| DT-8 | Native PDFium for documents beyond the web ceiling (V1-P13) | L | Rule 3 |
| DT-9 | Office ↔ PDF conversion, faithful DOCX export | XL | Rule 3 |
| DT-10 | Local models (D-1): B5, B18, alt text, handwriting OCR | XL | Rule 3 |
| DT-11 | HEIC pages | S | Rule 3 |
| DT-12 | PDF/A claims, only with a validator | M | |
| DT-13 | Plugin API | XL | |

**No telemetry in desktop either**; auto-update checks are the only built-in network call and can
be turned off.

**Owner questions:** (1) Saved signatures stay on the web? Recommended yes. (2) Is desktop free
too? (3) Tauri or Electron? Recommended Tauri. (4) Linux at first release, or macOS and Windows
first? (5) Direct download only, or app stores later?

### 5.3 Editable phone edition track (M10)

Phones only (ADR-0033). Shared editing logic under new phone controls in `shell/compact/mark/`.

**Principles:** reading comes first · one bar, one level · **the fewest icons that do the job** ·
every gesture has a button · no phone special cases inside full-shell components.

| Phase | Content | Exit |
|---|---|---|
| **M10-R Study** (reads only; can run any time) | Study Apple Markup, PDF Expert, GoodNotes, Notability, Acrobat mobile, Xodo and Procreate's edge control: bar layout, icon count, how tools are picked, thumb reach, gestures, undo. Inventory what exists: `shell/compact/CompactSheet.tsx`, `gestures.ts`, `compact-store.ts`, `CompactPassword.tsx` | A short report with screenshots-by-description and a recommendation |
| **M10-P Prototype** | Two clickable prototypes on the owner's phone: **A: two tools (Pen, Highlight) + a ＋ picker sheet** for the rest; **B: a five-tool rail** (Highlight · Pen · Sign · Fill · Note). Both behind `?lab=phone-mark` | **Owner picks A or B (decision gate).** Lean: A, the minimum, as the owner asked |
| **M10-0 Prep** (invisible) | Extract tool logic from the palette, `InkStrip`, `PenWell`, `AnnotationBar` into hooks/stores both shells call; extend the existing `CompactSheet` (half/full detents, grab handle, swipe only where missing); ED-4 rename | Full-edition visual baselines identical; editing chunk ≤ 120 KB gz, loaded on the first Mark tap. Starts **after the V1-R1 freeze**, or earlier only as new files under `shell/compact/mark/` |
| M10-1 Highlight from selection | Highlight, Underline, Note in the selection bar; editable notes; Undo; Share a copy | Highlight, note, share in < 20 s |
| M10-2 Mark mode | The chosen design (A or B); one finger draws, two pan; two-finger tap undo with a visible button; thin options row (3 colours, 3 sizes, Eraser inside Pen) | Annotate task passes portrait and landscape |
| M10-3 Fill & Sign | ‹ › Done stepping above the keyboard (visual viewport); Sign sheet; tap/drag/corner-scale; initials and date chips | Form → fill → sign → share in ≤ 6 taps, not counting typing |
| M10-4 Pages arrange | Select in the Pages sheet; long-press drag to reorder; Rotate, Delete, Extract | No accidental drags while scrolling |
| M10-5 Polish | Landscape, haptics, VoiceOver/TalkBack, honest "phone marks up, fills and signs" note | Q-1…Q-14 on phones; **owner-checked** pen latency on his own phone (≤ desktop + 1 frame); owner review |
| M10-6 (bet B1) | Text view as the phone's reading core | After M10-5 |

**Stays off the phone:** editing PDF text, redaction, Compare, OCR, conversions, crop and resize,
combine and batch, form creation, shapes and stamps, the history scrubber, the preset editor, tabs,
the Light Table.

**Owner questions:** (1) A or B after the prototypes? Recommended A. (2) Tapping a form field in
Read goes straight to Fill? Recommended yes. (3) Pages arrange waits for M10-4? Recommended yes.
(4) Edge size/opacity slider: build or drop? (5) A stylus draws from Read without ✎? Recommended yes.

---

## 6. Decisions the owner is asked for now

| Id | Decision | Recommendation |
|---|---|---|
| O-1 | Accept the edition split and placement rule (§1); update VISION, add ADR-0034 | Yes |
| O-2 | V1 criteria (§2): accept, amend or strike the **Must** list first; set the (tbd) numbers, the web size ceiling and N days | Discuss; defaults above |
| O-3 | **Spice** in V1: S2 (see the original), S1-1, E12, E13, E9a, E3 | Yes |
| O-4 | **Polish and teaching** in V1: E14, WEL-1 (first welcome, W2), E16 (W4) | Yes |
| O-5 | ◇ candidates: S4 + S3-Q, S8, E6b, E8b, S7; confirmed at the W2 gate; a ◇ that misses W3 acceptance is cut | Keep all five if W0–W2 hold; S7 first to drop |
| O-6 | Engine-lane performance work runs every wave without asking, gated by equality tests and before/after numbers; anything that changes pixels comes back for an OK | Yes |
| O-7 | Concurrency: up to 7 implementers + 1 QA per wave; heavy slots = floor(cores/4) | Yes |
| O-8 | **Phone pilot before V1?** M10-R study and M10-P prototypes A and B run in parallel with W1–W3 (read-only study, lab-flagged prototype, no change to the shipped phone reader) | Yes for M10-R and M10-P; M10-0 onwards after the V1 freeze |
| O-9 | Desktop and remaining phone questions (§5.2, §5.3) | Can wait until after V1 |
