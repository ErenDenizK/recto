# The quality charter

Eight rules every product of this maker keeps. None is new: each is already practised in at least
one repo, and most in all of them. They are written once here so each app's `CLAUDE.md` can link
them instead of restating them. A product's own rules may be stricter; they are never looser.

**To adopt**, add to the app's `CLAUDE.md`:

```md
- Quality charter: https://github.com/ErenDenizK/ErenDenizK.github.io/blob/dev/docs/family-kit/charter.md.
  This repo meets it as follows: <one line per rule naming the check, test or document that enforces it here>.
```

## The rules

### 1. Every effect has a still twin

Reduced motion, no WebGL, Low Power Mode, forced colours and phones each get a complete product,
not a broken one. The still twin is designed, not the absence of the effect: a still light in
place, a poster instead of a clip, a cross-fade of 150 ms or less instead of a move.
*Check:* run the product with `prefers-reduced-motion: reduce` and with forced colours, and
screenshot it. *Practised:* Recto (Glass Solid, Ambient Off, Reduce motion per token), English
Prep (three still pools, the motion toggle), the portfolio (CLAUDE.md rule).

### 2. Contrast is solved by measurement, not chosen by eye

Every text and essential-graphic pair is measured (WCAG 2 enforced; APCA as a second opinion)
against what it actually sits on: the ground, a glass material, or the brightest point of a light
field under its cap. Colour values come out of a solver with a target, and the check runs in CI.
*Check:* the product's colour script (`light.js contrast()` and `solveInk()` where it has none).
*Practised:* Recto (APCA module, contrast through the glass model, A-gates), English Prep
(`npm run color` across the aura's colour envelope).

### 3. Real captures only

Product images are captures of the shipping build: no mock UI, no stock, no invented metrics, no
fake device bezels, no tilt. A capture older than the product's last release shows its date.
Captures are made by a script kept in the product's repo, so they can be made again.
*Check:* every image in a presentation names the build or commit it was shot from
(presentation.md). *Practised:* English Prep's About folio (real 3× / 2× captures), Recto's own
screenshot scripts.

### 4. No characters as icons

No emoji, no Unicode arrows, ticks, crosses or stars standing in for an icon: they render
differently on every platform (the owner saw them turn into emoji on phones). Icons are drawn to
a contract: a grid, a stroke tied to the type, outline and fill states.
*Check:* search the UI strings and templates for symbol characters. *Practised:* Recto (Phosphor,
compiled), English Prep (`js/icons.js`, 24 grid), the portfolio (`tools/icons`), Eat Map (SF
Symbols).

### 5. Rest is still

Nothing loops to look alive. Motion answers an action or a change of place, on the product's own
springs (motion.md). Only ambient light may drift, on cycles of 9 s or more, paused when the page
or the light is hidden (light.md).
*Check:* an idle screen produces no animation frames once settled. *Practised:* Recto (idle
frames = 0 in CI), English Prep (atmosphere paused when hidden), the portfolio (no idle bob).

### 6. Seen before shipped, at three sizes

Every UI change is screenshotted and looked at before it is reported: **1440 × 900**,
**1180 × 820 with touch**, **390 × 844**. A product may add sizes (English Prep also verifies 320
and 768); a native app uses the simulator's equivalents (a current large iPhone, an iPad, and the
smallest supported phone). Desktop-first products still must not break on phones.
*Practised:* written into all three repos' `CLAUDE.md`.

### 7. Decisions are written

Choices of technique are recorded where the next session will find them: ADRs, specs, research
notes with dated evidence. Code comments cite the section a behaviour comes from. Taste is asked
of the owner; technique is decided and recorded.
*Practised:* Recto (ADRs, language.md, quality bar), English Prep (ADRs, design system), the
portfolio (`docs/adr/`, `docs/research/`).

### 8. The promise is proven

Each product's promise line (what stays with the user) links to its evidence: the network policy,
the storage code, the test that proves nothing leaves. A claim without proof is removed, not
softened.
*Practised:* Recto ("proof before promise": every privacy claim links to evidence), English Prep
(no backend, no accounts, `localStorage` only), Eat Map (private circle; evidence to be linked
when public).

## What the charter is not

Not a style guide: it says nothing about colour, type, shape or motion values, which stay each
product's own. Not a gate on taste: the owner decides how a product looks. It is the floor every
product stands on, and the reason a stranger can trust the next one.
