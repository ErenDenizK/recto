# Compact session JS (R28, Now)

Research plan behind `tools/qa/compact-session.ts` (Brief A, built). Rank 1 is Brief B. The tables below were taken on a build before the measure existed; the measure prints the current numbers. Nothing here is a decision until the lead records a row.

## Summary

**Short version:** The gated number (288 KB) is not what a phone loads. In a read-only session the phone loads about **511 KB gzip** of main-thread JS (1.48 MB raw, 41 files), because five unconditional idle prefetches add **223 KB** after paint. One of them, the editing chunk, accounts for 136–153 KB of that. It is the same pattern PR #105 was closed for, and it was already in the code. Fix the measure first, then cut the prefetches.

**How I measured.** I ran `tools/qa/bundle-budget.ts` read-only on an existing build: `a build of develop plus the margin-map lane`, which is develop plus the margin-map lane. It reports compact at 288.0 KB, the same as R27. Module shares come from that build's `bundle-modules.json`, so they are estimates (rendered length × chunk gzip). The closure walk follows the tool's own static-edge rule.

## What a read session loads (gzip)

**The static closure, 288 KB:**

| Chunk | Size | Main contents |
|---|---|---|
| react | 66.0 | |
| main + i18n runtime + helpers | ~8 | |
| editions | 181.9 | see below |
| compact-core | 23.0 | |
| motion | 6.8 | |

Inside `editions` (181.9):
- Base UI: about 70 in total. The floating stack is ~48: floating-ui-react 22.7, menu 10.9, popover 3.5, tooltip 3.2, @floating-ui/* 8. Shared internals/utils are another ~15.
- `icons.generated.tsx`: 9.3, all 111 icons.
- Message modules: 7.5. Every message carries both EN and TR.
- document-model: ~25. session/*: 9.2. engine-service: 6.1.
- Toast/scroll-thumbs/LinkLayer: ~7.

**Idle prefetches that fire in every read session (+223 KB in total; the rows overlap):**

| Prefetch | Trigger | Adds |
|---|---|---|
| `mark` (the editing chunk) | `usePrefetchMark`, idle, 4 s timeout | **153.3**: actions 61.8, AnnotationLayer 33.5, Segmented 27.4, mark 15.6, edit-runner 5.1 and others |
| `./fields` | loaded by mark as it arrives | +11 |
| `CompactMoreSheets` | EDN-10, idle | 53.4 (27 of it shared with mark) |
| overview | idle | 22.1 |
| glass renderer | | 8.9 |
| liquid-menu + container-transform | | ~4 |

Two of these were moved out to stay under the gate:
- `mark-host.ts` says `chrome-spring` "rides in it to keep the static compact path under its gate".
- `SelectionHost` only mounts once mark has arrived.

**First visits and deploys are a separate problem.** Under PF-17 the service worker precaches every chunk anyway. So lazy-loading cuts parse/eval work and contention with the 2.1 MB PDFium wasm, but not first-visit bytes. Only deleting code, or precaching by edition (P1), cuts network bytes per install or deploy.

## Ranked candidates

1. **Take the editing chunk off the read path.** Real saving −136 KB gzip of session JS (−27 %), about 450 KB raw not parsed on a throttled phone. Static closure +~2.5 KB. Risk: medium (first ✎ tap latency). 1.5–2 days.
   - The phone needs it only once the user edits, selects text, or opens a form.
   - Change: drop the idle prefetch. Load mark on ✎ pointerdown/tap, on the first settled text selection, or when the document has form fields.
   - Move `chrome-spring.ts` (3.3 KB raw) and `selection-host.tsx` (4.4 KB raw) into the static path.

2. **⋯ sheets on intent** (amend EDN-10, an implementer row, so the lead can change it). Real saving −~50 KB once item 1 lands. Risk: low. 0.5 day.
   - Prefetch on pointerdown of ⋯ or the title trigger instead of on idle.
   - The Library's Settings path is unchanged.

3. **Shrink the editing closure.** Real saving −~60–80 KB for every session that edits, plus faster ✎. Risk: medium. 2–3 days.
   - `actions` (61.8) is a desktop shared chunk: 15.4 of it is messages, plus ColourPanel 9.3, Slider ~6, lasso 3.6, context-menu.
   - `Segmented` (27.4) is Select, Tabs, Dialog and Sheet.
   - mark reaches both through `annotations/actions`, `InlineEditors` and `ui/Segmented`. Cut those edges the way P4 cut `targetPages`.
   - `fields` and `selection-bar` statically import the mark chunk today (164 / 156 KB closures). Cut that too, so Copy and Fill do not need the editor.

4. **Floating stack out of the static path.** Real saving ~40–45 KB, but only for sessions that never open a menu, a link popover or a touch-hold tooltip. Risk: medium-high (focus return, `compact-menu` e2e). About 3 days.
   - The ⋯ menu would become a plain trigger that imports `Menu` on pointerdown and opens with `defaultOpen`.
   - The Tooltip's Base UI part would mount on first hover, focus or touch-hold start (the 450 ms hold hides the fetch).
   - Add a named `codeSplitting` group so the editor gets one stable chunk, not #105-style fragments (#105 grew the editor ~4 KB).
   - Base UI Drawer/Dialog also use floating-ui-react, so this only pays off after item 2.

5. **One language's messages per session.** About 8–12 KB of session JS for the compact edition, more for the editor. Risk: medium-high (touches Paraglide output and the language switch). 3–4 days.
   - Messages total about 25+ KB across the chunks above.
   - Approach: have the Paraglide build put the TR strings in a lazy table, or emit per-locale message modules.

6. **Icon subset.** About 5 KB. Risk: low-medium. 1.5 days.
   - A read session draws about 25 of the 111 icons.
   - The generator would emit a compact core set plus a lazily registered rest.

7. **CSS.** Compact loads about 21 KB gzip (main 9.2, editions 6.2, compact-core 5.4). Small; leave it.

8. **Network side** (owner decision under PF-17): P1, precache by edition. A phone would skip about 700 KB gzip per install and per deploy: editor 312, desktop sheets ~100, compress.worker 290. The fontkit/icon-tile work is already on `r27/perf-fontkit-icons`.

## Measure spec: "compact session JS", gated in place of the static closure

**New script, `tools/qa/compact-session.ts`.** It uses the Playwright already in the CI `verify` container (no new dependency) and runs after **Build** and before **Bundle budgets**.

Setup:
- Static server on `dist`.
- Pixel 7 profile, 390×844, touch.
- `serviceWorkers: 'block'`, so every fetch is visible.
- Locale `en`.

Scenario "read":
1. Open `/` and wait for `compact-library`.
2. Tap **Try the sample**.
3. Wait for page 1's canvas to reach `data-state="rendered"`.
4. Touch-scroll to the last page and wait for it to render.
5. Wait at least 15 s after the first page and until 5 s with no request. This covers every idle timeout, which tops out at 4 s.

Recording:
- Record every main-frame request for `assets/*.js`, excluding `*.worker-*`, the files reached statically from worker entries, and wasm.
- Run the scenario twice and take the union of the file lists.

Output, written to `apps/web/node_modules/.cache/recto/compact-session.json`:
- The file names.
- The `main-*.js` file name, as a build fingerprint.
- The scenario's version.

**Changes to `bundle-budget.ts`:**
- New measure `compactSession` = the gzip of the listed files, recomputed from `dist`, so the browser only names files.
- Fail if the JSON is missing, or if its fingerprint does not match this `dist`.
- Fail if any file of the static `compact` closure is absent from the list. A closure larger than the session means the scenario is broken.
- Print an "after paint" list: the session files outside the static closure, each with its gzip size, so a move shows in review.
- Keep `compact` (the static closure) as a printed sub-measure with only its absolute 320 KB ceiling. The 1 % growth cap moves to `compactSession`.
- Add a printed, ungated scenario "⋯ opened" so intent costs stay visible.
- The first baseline (about 511 KB) needs the owner's sign-off under PRC-11, in its own commit.

## Recommendation for this week (two Sonnet briefs, in this order)

**Brief A: the session measure.** Owns `tools/qa/compact-session.ts` (new), `tools/qa/bundle-budget.ts`, `tools/qa/bundle-budget.json` (add the gate key only; the baseline is written by the lead after owner sign-off) and `.github/workflows/ci.yml` (one step).
- Implement the spec above exactly.
- Acceptance:
  - On current develop the script reports ~511 ± 5 KB.
  - Re-applying #105's diff locally leaves `compactSession` unchanged or higher.
  - A deliberately deleted session file in the JSON fails the run.
- 1.5 days.

**Brief B: the editing chunk on intent.** Owns `shell/compact/mark-host.ts`, `CompactChrome.tsx`, `CompactReader.tsx`, `mark/index.ts`, and moves `mark/chrome-spring.ts` and `mark/selection-host.tsx` up to `shell/compact/`.
1. Delete `usePrefetchMark`. Call `loadMark()` on pointerdown of ✎ and keep the existing load on tap.
2. Import `springChrome` statically in `CompactReader` (MOT-16 springs from the first scroll).
3. Mount `SelectionHost` from `CompactChrome` always. Its lazy `selection-bar` brings mark on the first selection, which is intent; Highlight keeps working.
4. When the open document's form-store `fields` list is non-empty, call `loadMark()`. Fields keep mounting in reading.
5. Add a decisions row (editions area) that amends EDN-10 for editing code: "editing code loads on intent, never on idle".

Acceptance:
- Brief A's `compactSession` falls by ≥ 120 KB.
- Static `compact` grows ≤ 3 KB.
- Run `compact-*.spec.ts`, the editing, forms and selection specs on the phone project.
- Check ✎ first-tap to island on a 4× CPU profile with a warm cache (report the ms).

1.5–2 days. Brief B needs the lead to accept the gate swap from Brief A first; on today's static gate it would fail by ~1.5 KB.
