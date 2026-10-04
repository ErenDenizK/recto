---
title: "ADR-0027: Type and icons: an Inter Recto subset and Phosphor built at compile time"
date: 2026-10-04
status: proposed
---

# ADR-0027: Type and icons: an Inter Recto subset and Phosphor built at compile time

**Status:** proposed · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes on acceptance:** DESIGN §3 "Icons: one consistent 1.5px stroke set (Lucide or
Phosphor), 16px in chrome, 20px in the tool bar" and "Typography: 13px UI base, 12px
secondary, 11px labels with tracking"; the `--font-mono` and `--tracking-ui` tokens · **Amends:**
ADR-0003 ("Lucide icons") · **Rests on:** `language.md` §4.1–§4.4, §5.1–§5.2, §11.1 item 6;
`flows.md` §13.2 item 10; research 20 T-1 to T-10, I-1 to I-8, X-3; 22 A-21, §12

## 0. Summary

- Inter stays the only UI face, self-hosted as `'Inter Recto'`: two subsets of upstream Inter
  4.1.1 with optical sizes and the features Recto uses, 98 KB with Turkish.
- No italic file; JetBrains Mono leaves the UI (the engine's bundled copy stays).
- One type scale with a coarse-pointer step, sentence case, tabular numbers.
- Phosphor regular and fill, generated at build time from `@phosphor-icons/core`: outline at
  rest, fill when selected.

## 1. Context

`main.tsx` imports `@fontsource-variable/inter/wght.css`: 47.1 KB, plus 83.1 KB once a Turkish
character shows (130.2 KB). That file has no `opsz` axis, so `font-optical-sizing: auto` does
nothing, and it strips `case`, `cv05`, `cv08`, `ss03` and `zero`. JetBrains Mono (54 KB, from
`@fontsource-variable/jetbrains-mono`) sets technical strings in 18 CSS modules through
`var(--font-mono)`. The section labels are uppercase and tracked.

Research 20 compared 26 OFL families with full Turkish. Inter has the tallest x-height
measured (0.546 em), tabular figures and an optical-size axis; Geist was the strongest
alternative. It compared six icon sets on Recto's 39 core concepts: all cover them, but only
Phosphor has a designed fill twin for each (Tabler 23, Lucide 0). Apple's rule, outline at rest
and fill for selection, needs that twin. ADR-0003 named Lucide; 59 files import `lucide-react`.

## 2. Decision

1. **Inter as `'Inter Recto'`** (T-1, T-2): cut from upstream `inter-ui` 4.1.1 by a committed
   `tools/fonts/subset.sh` (`pyftsubset`) into `inter-recto-latin.woff2` (73.4 KB: U+0000–00FF,
   U+0131, U+0152–0153, U+2000–206F, €, ™, arrows, ⌘ ⌥ ⌃ ⇧ ⌫ ⎋) and
   `inter-recto-latin-ext.woff2` (24.6 KB: U+0100–017F, U+0218–021B, ₺). Axes opsz 14–32 and
   wght 100–900; features kern, mark, mkmk, ccmp, locl, calt, case, tnum, pnum, frac, cv05,
   cv08, ss03, zero. Served from the origin (`font-src 'self'`), precached under ADR-0010's
   1 MB rule, `font-display: swap`, Latin preloaded, and a fallback face with `size-adjust` and
   ascent and descent overrides from the same script so the swap does not move layout. The
   private name keeps a locally installed Inter from substituting.
2. **No italic file** (T-3); the two italic hints use the tertiary colour. **JetBrains Mono
   leaves the UI** (T-4): technical strings (origins, byte counts, versions, hashes) use Inter
   with `tnum` and `zero`. The engine's `packages/engine/assets/fonts/JetBrainsMono-Regular.ttf`,
   the monospaced substitute of ADR-0020 §5 and a page-furniture face, is not touched.
3. **Scale** (`language.md` §4.2), fine / coarse in px: caption 11/14 · 12/16 (500); footnote
   12/16 · 13/18 (450, 500 on glass); body 13/18 · 15/20 (450, buttons 550); callout 15/20 ·
   17/22; title 3 17/22 · 19/24 (600); title 2 22/28 · 24/30 (650); title 1 28/36 · 30/38 (650);
   display 40/44 and 56/60, About only. Tracking follows Inter's dynamic metrics, +0.005 em in
   dark at 13 px and below. Text inputs are 16 px on coarse pointers. At most three sizes per
   surface, weight before size (X-3); never below 400.
4. **Finish** (T-7 to T-10): `tnum` on every changing number; `case` on keycaps; `cv05` and
   `cv08` where characters must be told apart (file names, Find, passwords, page labels);
   sentence case everywhere, the tracked uppercase labels replaced by footnote 550 in secondary;
   `text-wrap: balance` on titles, `pretty` on paragraphs, `text-box` trim in capsules.
5. **Turkish** (`language.md` §4.4, A-21): `lang` on the root follows the locale; never
   `text-transform: capitalize`; script case mapping always passes the locale, enforced by a
   lint; line height ≥ 1.25 × size wherever text can clip; labels designed at 1.8 × the English
   length; the *siz* register, written, not translated.
6. **Phosphor regular and fill** (I-1): `tools/icons/generate.ts` reads `@phosphor-icons/core`
   2.1.1 (a devDependency) for the names in `tools/icons/manifest.json` and writes
   `ui/icons.generated.tsx`, two paths per icon and one `<Icon name filled size />`; about
   18 KB gzip for ~90 icons. `@phosphor-icons/react` is never imported.
7. **Use** (I-2 to I-7): outline at rest, fill when selected (the armed tool, the current
   navigation item, the on segment, the current filter); action glyphs never swap. Sizes 16, 20,
   24 px with a stroke of 1/16 of the size; 32 and 48 duotone for empty states and About.
   Monochrome. Groups and uncommon tools carry a label or a tooltip with the key (RA-20). Custom
   glyphs on Phosphor's 256 grid with fill twins: Redact, Edit text, Compare, Combine, Page
   furniture, the Recto glyph.
8. **Mapping** (`language.md` §5.2 with `flows.md` §13.2 item 10): Markup `pen-nib` (pens show
   ink dots), Fill & sign `signature`, Pages `squares-four`, More `dots-three`, signed
   `seal-check`, Lock `lock-simple` / `lock-simple-open`, undo and redo `arrow-u-up-left` /
   `-right`.

## 3. Consequences

- Out: `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `lucide-react` once
  no import remains. In, as devDependencies: `inter-ui` 4.1.1 and `@phosphor-icons/core` 2.1.1.
  Committed outputs: the two woff2 files under `apps/web/public/fonts/`, the generated icons.
- Fonts: 98 KB against 130 KB (plus 54 KB of mono) today; icons about 13 KB more path data.
- Every screenshot test changes once (glyph shapes and metrics).
- On acceptance the lead amends ADR-0003's "Lucide icons" to point here and rewrites DESIGN §3's
  icon and typography lines.

## 4. Alternatives considered

- **Geist:** smaller files and Turkish `locl`, but 3 % narrower with a lower x-height (0.530 em),
  and it signals one company's products. **Figtree, Hanken, DM Sans, Instrument Sans:** smaller
  x-height or no tabular figures. **Google Sans Flex:** 2,040 KB for all axes.
- **Keep Fontsource Inter:** no `opsz`, none of the features above, 130 KB with Turkish.
- **One file with both ranges (92.2 KB):** English sessions would load 18.8 KB they never use.
- **An italic file (83.3 KB) or synthetic oblique:** for two hints; oblique looks cheap.
- **Keep Lucide and draw fills for ~16 icons (research 20's fallback):** fewer bytes, more design
  time, and the fills would never match Lucide's line as Phosphor's twins do.
- **Tabler (23 fills of 39), Fluent (Windows-flavoured), Material Symbols (heavier, Google's
  look), Hugeicons free (no fills):** rejected on fill coverage or voice.
- **`@phosphor-icons/react`:** every icon module carries six weights (`PenNib` 1.36 KB gzip).
- **An About display face (Instrument Serif, research 20 Q5):** the brand track's call, not
  this ADR's.
