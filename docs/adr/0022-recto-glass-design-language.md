---
title: "ADR-0022: Recto Glass: content solid, controls glass, light beneath"
date: 2026-10-04
status: proposed
---

# ADR-0022: Recto Glass: content solid, controls glass, light beneath

**Status:** proposed · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes on acceptance:** DESIGN §1 "Nothing glows" and its one-elevation sentence; DESIGN
§3 "Dark is the default … a light theme is an M9 item", "One elevation, for floating chrome
only", "Translucency only for floating chrome" · **Rests on:** `language.md` §0, §0.1, §0.2,
§11.1 items 1 and 7; `flows.md` §1.2, §13; research 16 G-1, G-2, G-25; 17 AU-4, AU-5, AU-8;
20 C-1, C-15, S-5; 21 BR-B1, BR-B2, BR-B5; 22 A-22

## 0. Summary

- Three layers: the page and everything on it is solid content; controls are glass; light
  lives beneath the glass, never inside it and never on a page.
- Eight principles bind every component spec (§2.2).
- DESIGN §1's "Nothing glows" becomes "Only light glows: the aurora and the glass rims;
  controls never glow".
- A light theme ships with M9, equal to dark, following the system.

## 1. Context

The owner's M9 brief asks for every element rethought for glass, light and motion: simple and
native like Apple Preview and Notability, few predictable steps, phone and desktop, and a feel
that is "smart, rich and expensive". It rules out a reskin.

DESIGN §1 (2026-09-26) asked for the opposite look: "Quiet, dense, professional … the
application recedes into a near-black field. Nothing glows", one elevation token, glass only on
floating chrome, dark only. M6 to M8 kept that and added three glass rules. Research 13 found
that glass over the flat canvas composites to a flat colour: the bar sat 1.03:1 against the
canvas before M6. Research 16 §0 explains why: glass shows only where content moves under it
or light sits behind it. Research 17 then showed that a still light field costs nothing (4.4 %
CPU with or without it), while a moving one costs a full composite every frame.

Two limits held throughout. The page must stay the brightest thing (BR-B1), and nothing may
move at rest. Research 22 adds a third: every effect needs a complete solid twin (A-22).

The three interaction proposals (A, B, C) all assumed one language; `language.md` defines it
"for whichever interaction model the flows panel picks". `flows.md` §13 places it on the
chosen model and asks ten amendments of it (§13.2), accepted here.

## 2. Decision

### 2.1 Three layers

1. **Content is solid.** The page, its annotations, fields, redaction marks and selection
   overlays; thumbnails, Pages grid cells and Library card artwork; in-place editors and text
   inputs. Never glass, never themed, never lit (`language.md` §2.10).
2. **Controls are glass.** One material in five densities plus a lit variant (ADR-0024).
3. **Light lives beneath glass.** One aurora field and three small light events (ADR-0025).
   No light is painted inside a glass surface under text (AU-8).

### 2.2 Eight principles (`language.md` §0.1, with `flows.md` §13.2 item 8)

1. Content is solid, controls are glass, light lives beneath glass.
2. The page is the brightest thing: light stays ≥ 2.5:1 below a white page and never within
   64 px of one. Library thumbnails are exempt from the 64 px distance and keep the brightness
   rule (I 0.6 cap under lit glass, Library mean Y ≤ 0.03), while A-6's pixel test covers them:
   their pixels are identical with light on and off (spec 02.1, amended before acceptance).
3. One lime element per view at rest: the armed tool or the primary action (ADR-0023).
4. Bigger is denser and slower: transmission falls from 0.21 (chips) to 0.07 (sheets); spring
   duration rises from 0.20 s (press) to 0.46 s (full-window move).
5. Rest is still; motion answers. Nothing loops in a document view.
6. Continuous and interruptible; nothing waits longer than 250 ms (ADR-0026).
7. Every effect has a solid twin: with Glass Solid, Reduce motion On, Ambient light Off and no
   `backdrop-filter`, the app is complete and passes every rule (ADR-0028).
8. State is shape and words, never colour or light: Markup and Lock are shown by a glyph, a
   label and a control's shape; chrome is never tinted by state and light never signals it.

### 2.3 Only light glows

DESIGN §1's "Nothing glows" becomes: **"Only light glows: the aurora and the glass rims;
controls never glow."** No coloured outer shadow on buttons, tools or focus (S-5, G-2).
Elevation becomes the e0–e5 scale of `language.md` §6.3; docked surfaces keep e0.

### 2.4 A light theme from day one

Theme **System · Light · Dark**, default System, equal to dark (C-15). Light glass floors its
backdrop with `contrast(0.45) brightness(1.4)` (G-25), so black under it is the worst case, as
white is for dark glass. The aurora becomes pigment (AU-21); the armed-tool under-light and lit
glass stay dark-only. The page is never themed in either theme; "dim pages" stays dark-only.
`index.html` sets `theme-color` per scheme (`#08090c` / `#e6e8eb`).

### 2.5 One source of values

Every colour, material, type and motion value comes from `tokens.css` as structured in
`language.md` §10.1 and is asserted by `tokens.test.ts`. Five settings replace "Glass panels"
and "Reduce transparency": Theme, Glass, Ambient light, Reduce motion, Haptics (Android).
ADR-0023 to ADR-0028 record the parts.

## 3. Consequences

- On acceptance the lead rewrites DESIGN §1 and §3 from `language.md`; §3's token block,
  "one curve" and "no springs" rules go with ADR-0026, its glass rules with ADR-0024.
- Two themes double the token assertions and the accessibility matrix (dark × light).
- The work lands in the eleven shippable steps of `language.md` §10.4; the first step
  (selection blue, two-band ring, σ 8 on the 44 px bar, coverage term) fixes failures valid
  today.
- The page stays the worst backdrop by construction: every glass tier is capped over white
  (dark) or floored over black (light), and the light field never reaches a page.
- The language does not decide interaction. The redesign is "no reskin" because `flows.md`
  changes the model (ADR-0029 to ADR-0032), not because the colours change.

## 4. Alternatives considered

- **Keep DESIGN §1 and add glass only to floating chrome (the M8 state):** glass over a flat
  dark field reads as a slab or vanishes (research 13, 1.03:1); it cannot give the owner his
  glass and light.
- **Apple's iOS 26.0 look, glass on content and a clear variant:** reviewers measured 1.5:1;
  Apple added Tinted in 26.1 (research 22 §7). Research 16 copies Apple's later endpoint.
- **Research 20's wording, "No control glows; light lives only in the atmosphere layer":** the
  same rule, but it leaves out the rims, which glow by design (G-2).
- **Light theme later (research 16 G-25):** the owner's references are light apps, phones
  often run light, and the About page and screenshots need both (`language.md` §0.2).
- **DESIGN §3's planned light theme as "the same ladder inverted":** inverted dark glass over
  a black backdrop fails; light glass needs a floor, not an inversion (`language.md` §2.2).
