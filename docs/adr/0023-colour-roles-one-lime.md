---
title: "ADR-0023: Colour roles: one lime for interaction, a blue for selection on the page"
date: 2026-10-04
status: proposed
---

# ADR-0023: Colour roles: one lime for interaction, a blue for selection on the page

**Status:** proposed · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes on acceptance:** ADR-0021 §4 ("The accent `#7c8cff` stays"); DESIGN §3's accent
lines, its "The accent `#7c8cff` is unchanged" sentence, its on-page accent rings and handles,
`--tag-4` olive · **Keeps:** ADR-0021 §3 (inks and highlighter tints) · **Rests on:**
`language.md` §0.2 rows 1 and 9, §1.1–§1.9, §11.1 item 2; research 20 C-1 to C-9, C-15; 21
BR-B2, BR-B5; 22 A-19, §11

## 0. Summary

- Four colour roles that never mix: atmosphere, interaction, content, status.
- One lime, `#c8fb3d`, for the accent, the focus ring's light band and the brand.
- A selection blue, `#4e61ed`, for every selection mark on a page.
- Cool graphite neutrals (hue 265) in both themes; warning moves to hue 72; tag 4 becomes lilac.

## 1. Context

ADR-0021 §4 kept the periwinkle accent `#7c8cff` because a more saturated colour of its hue
would break the armed tool's 3:1 against the glass. It fails elsewhere: 2.98:1 on white for
on-page rings and handles (WCAG 1.4.11 asks 3:1), 3.03:1 for the armed fill against tier-1
glass over white in the model, and 2.22:1 on the bar as rendered (research 22 §3.2). The focus
ring in the same colour shows 2.98:1 on a white page and 2.40:1 on a 35 % aurora.

Research 20 proposed lime `#c8fb3d` (oklch 0.921 0.210 124) as the accent: 16.42:1 under ink,
7.4:1 or more against glass over white. Lime fails on paper (1.21:1 on white) and sits close to
the yellow and green highlighters, so research 20 split selection on the page into its own
blue, as macOS splits accent and highlight colours. Research 21 proposed a separate brand lime
`#e2f73d` (hue 116) with `#49780d` as its ink. The aurora (ADR-0025) is lime light; a periwinkle
control beside it reads as a second brand (research 20 §9 Q1, research 17 §13.2).

## 2. Decision

1. **Four roles** (`language.md` §1.1, C-1). *Atmosphere*: the aurora; never on or within
   64 px of a page, never a signal. *Interaction*: lime with ink; chrome only. *Content*: page
   white, ADR-0021's inks and tints, `--select`. *Status*: danger, warning, success, always
   beside a glyph and words. A review rejects any colour that crosses its row.
2. **One lime.** `--accent: #c8fb3d`, 8 % under the sRGB cusp; hover `#ddff82`, pressed
   `#b2e93c`, ink `#08090c`. It is the accent, the focus ring's light band (ADR-0028) and the
   brand's lit element: one value in the app, the icon and the About page (BR-B5). It stays
   sRGB everywhere; its P3 headroom goes to the aurora only. Hue 105–116 appears only in the
   aurora's hottest light.
3. **Lime always touches ink** (C-4). Dark theme: lime fill, ink label or glyph. Light theme:
   ink fill `#15171c`, lime label or glyph (14.79:1); 1 px rings in lime-800 `#446713`. Lime
   is never text on a light surface, never on the page, never the only cue for a state.
4. **One lime element per view at rest** (C-5, X-1): the armed tool or the primary action.
   Beyond it only the focus ring, the 2 px current-thumbnail ring and dots up to 8 px. The armed
   ink preset gets a 2 px n12 ring with a 2 px ink gap, since lime vanishes beside the tints.
5. **Selection blue.** `--select: #4e61ed` (0.561 0.210 272) for the lasso box, handle
   strokes, the text-run hover outline, drop targets on a page and the undo flash on a page.
   Multiply washes: 0.25 (`#d3d8fb`) for text selection, lasso area and search hits; 0.45
   (`#afb8f7`) for the current hit. Form separates it from the blue ink `#1760ee`: selection is
   a dashed box, a handle or a wash, never a stroke of ink.
6. **Neutrals** n1–n12, hue 265, chroma ≤ 0.013, per theme (`language.md` §1.3): roles 1–2
   backgrounds, 3–6 surfaces, 7–8 borders and disabled, 9–12 text.
7. **Status** (`language.md` §1.6): danger `#fd7273` / light `#c21725`; warning `#ffb756` /
   `#985600`, moved from hue 86 to 72, away from lime and lemon; success `#56d1a3` /
   `#007654`, only for signature validity and verified results. Each has a glass variant.
8. **Tags:** six; tag 4 olive `#a6b27c` (the accent's hue) becomes lilac `#b1a1d1`; light tags
   `#327f6e #966b21 #945067 #5d728e #7c68a1 #965c39`. Dots beside a name, ≥ 3:1, never alone.
9. **What replaces `#7c8cff`** follows `language.md` §1.9: armed tool and primary button lime
   fill (dark) or ink fill (light); current rows lime 0.12 (dark) or ink 0.07 (light);
   `--accent-line` lime 0.50 or lime-800; everything on a page `--select`.

## 3. Consequences

- Armed fills clear 3:1 against every tier with room: lime 7.79–9.99 (dark), ink 11.18–14.65
  (light). The glass densities are no longer bound by the accent (ADR-0024).
- On the page `--select` gives 4.93:1 on white, 4.00 on the yellow tint, 3.53 on the green.
  Today's on-page failure is fixed in migration step 1, before the rest (`language.md` §10.4).
- Under protanopia and deuteranopia lime and the yellow highlighter differ by ΔE 2.2: lime
  must never mark the page (A-19). Warning and danger are identical for deuteranopes in the
  light theme (ΔE 1.3), so they always carry a triangle or a cross and words.
- `tokens.test.ts` and `palette.test.ts` re-assert every pair of `language.md` §1.7; the
  periwinkle minima retire.
- On acceptance the lead marks ADR-0021 §4 superseded by this ADR and edits DESIGN §3 (accent,
  state patterns, buttons, on-page rings, tags). ADR-0021 §1–§3 stand unchanged.

## 4. Alternatives considered

- **Keep `#7c8cff` (ADR-0021 §4):** fails WCAG 1.4.11 on the page and on the rendered bar.
- **Two limes, brand `#e2f73d` and accent `#c8fb3d` (research 21 against 20):** hue 116 sits
  ΔE 4.5 from the yellow highlighter against 7.6 at hue 124; `#49780d` gives 4.30:1 on the light
  canvas where lime-800 gives 5.35:1; two values drift apart across app, icon and About.
- **Lime only as light, periwinkle for controls (research 20 Q1):** two brands on one screen,
  and the under-light (AU-10) would have to go (research 17 §13.2).
- **Lime for selection on the page too:** 1.21:1 on white; as a wash it lands between the
  yellow and green highlighters, so a search hit looks like the user's own mark.
- **Light-theme lime fill with a hairline, or deep olive (research 20 C-4 mocks):** the first
  reads as a highlighter stroke, the second looks dated; ink with a lime label carries the brand.
- **Green-grey neutrals (research 20 Q2):** cool graphite lets the warm lime sit on cool shadows.

## 5. Issues for the lead

1. **Is Select lime when it is the armed tool?** `flows.md` §4.3 opens Markup with Select armed
   and fills the armed tool (I-2) with the lime under-light; DESIGN §3 (M8) gave Select the
   view-switch look so the bar "carries no accent block at rest". This ADR decides: Select
   armed shows its fill glyph on `--surface-on` (n5), with no lime and no under-light; lime and
   the under-light start when a creating tool is armed. The palette spec should confirm.
