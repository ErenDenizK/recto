# Motion 2026-10: forms, sign, sheet contents and the compact edition

R14 motion sprint, forms lane. The goal is that every state change shows where a thing came from
and where it goes. Everything here uses the motion core (`src/motion/`), the spring tokens and
`reducedMotion()`. At rest nothing is left inline (Q-2), and nothing runs once a motion ends
(Q-10).

New shared entries go in `motion/feedback.ts` rather than the hot `catalogue.ts`:

| Entry | Moves | Timing | Reduced motion |
|---|---|---|---|
| `shake` (refusal) | `translateX`, a sine of 3 cycles decaying linearly from 8 px | 360 ms | A danger-tint background pulse, 150 ms |
| `receivePulse` (receive) | `scale`, kicked from rest at 3.2/s on `pop` (about a 10 % peak, one small overshoot) | about 400 ms | The chrome ring held still (`ringFlash`) |
| `navPush` (iOS push) | Child page `translateX` from 100 %. Parent moves −30 % with opacity 1 → 0.45, clipped at the child's leading edge | `smooth`, sampled at 120 Hz | Incoming page fades, 150 ms |
| `disclose` (disclosure) | Height and block padding grow together from 0; content opacity follows over the last ¾ | `smooth`, reversible with velocity | Fade, 150 ms |

## 1. Form fill: the field ring (`forms/FieldRing.tsx`)

- **Before:** the active field had a static outline that jumped from field to field.
- **Now:** one ring slides between fields when you press Tab, Shift+Tab, use the stepper's ‹ ›,
  or click the next field.
  - **Hand-off:** as the old ring unmounts it records its screen rect. A new ring that mounts
    within 400 ms flies from that rect.
  - **What moves:** the ring's position moves by `transform`. Its size moves by `width` and
    `height`, because scaling a 2 px ring from a text line down to a check box would thicken it.
    Both run on `smooth`.
  - **Scroll:** after one frame the ring calls `scrollIntoView({ block: 'nearest', behavior:
    'smooth' })`. The behaviour is `auto` under reduced motion.
  - **Keyboard visit:** the ring takes the focus colours, and the field's own focus band steps
    aside, listed in `focus-scan` SUPPRESSED. Two rings never draw.

## 2. Ticks, signatures and ink

- **Check box and radio tick-in** (`forms/TickIn.tsx`)
  - PDFium paints the value a few frames after the commit. Until then a glyph in page ink sits on
    the widget.
  - The check draws itself (`stroke-dashoffset`, `--duration-base`) while it scales from 60 % on
    `pop`. A radio dot pops in from nothing.
  - Once `whenPainted` resolves, the glyph fades over `--duration-fast` onto the page's own
    glyph. Unchecking shows nothing extra.
- **Placing a saved signature** (`signatures/flight.ts`, `placement-flight.ts`)
  - The armed stamp's image flies from its chip (or the Sign button) to the stamp's box on
    `smooth`. It arrives at 1.06 and settles to 1 on `quick`, like a stamp, then fades onto the
    page.
  - The page draws the stamp before the flight lands. A still of the page canvas, taken as the
    tool lets go, covers the stamp until the flight arrives, so the signature is never on screen
    twice.
  - Placement is detected by the tool leaving `signature` with a signature still armed, followed
    by a new stamp box on a page. The palette's rule clears the placing selection in the same
    store update, so a selection listener never sees it.
- **Use** in New signature
  - The signature image shrinks from the pad (or the type or image preview) into its new chip,
    or into the Sign button. It fades out over the last 55 % of the `smooth` settle.
  - The chip then gets `receivePulse`.
- **Ink smoothness** (`signatures/smooth-ink.ts`)
  - The pad, the saved plate (SVG) and the placed image (`annotations/stamps.ts`) all trace the
    same quadratic midpoint curve. Before, they drew straight runs between samples, so a fast
    stroke looked polygonal. The three now look the same.

## 3. Field stepper odometer (`forms/Odometer.tsx`)

- Each character of "3 / 12" or "12 fields" has its own slot, aligned from the end of the text.
- When a slot's character changes, the new one rolls in on `quick`. It comes from below when the
  number grows and from above when it shrinks.
- The old character leaves the other way and fades over `--duration-base`, as an `aria-hidden`
  ghost.
- The readout clips its slots, and the text stays readable by the live region.
- Under reduced motion the new character only fades in.

## 4. Save a copy disclosures (`export/SaveCopySections.tsx`)

- The folded sections (Security, Metadata, Flatten, Signature, and the image and text options)
  open and fold with `disclose`.
- A closing panel stays mounted (`inert`) until its fold ends, so opening one section while
  another closes shows one growing and the other shrinking.
- The old CSS opacity-only `section-in` on the panel is gone.

## 5. Settings navigation (`settings/SettingsSheet.tsx`)

- **Before:** X8's 24 px push with a fade. Only the new page moved.
- **Now:** a row or ‹ Back clones the page on screen as an inert stand-in (`aria-hidden`, ids
  and test ids stripped, scroll position kept). The clone is laid over the sheet body, and
  `navPush` runs. The sheet body's own `overflow: hidden` clips both pages.
- A page reached through an opener (`openSettings({ row })`) keeps the X8 push.
- **Pitfall found:** the React Compiler treated `const outgoing = leaving; leaving = null` on a
  module variable as an alias. It read `leaving` after the reset, so the stand-in was always
  null. The fix is that `takeLeaving()` returns and clears the stand-in inside one function.

## 6. Refusals

| Where | What shakes |
|---|---|
| The unlock prompt (`shell/PasswordDialog.tsx`) and the compact one (`CompactPassword.tsx`) | The field, after a wrong password |
| Certificate (`CertificateSheet.tsx`) | The password field, after a refused file or password |
| Set password (`PasswordSheet.tsx`) | Both password fields, after a submit with a problem |

Strip metadata has no refusal state, so nothing shakes there.

## 7. Compact edition (`shell/compact/`)

- **Sheet release** (`sheet-release.ts`)
  - CSS transitions cannot take a velocity, so as the finger lifts the sheet gets two
    `springToLinear()` curves carrying the release velocity in distances per second. One goes
    toward the detent and one toward the closed position.
  - The token is `fling` above 300 px/s and `glide` below. These are the same tokens and the
    same threshold as `ui/sheet` uses.
  - Whichever end state Base UI sets selects its curve (`[data-released]` and
    `[data-ending-style]`). The attribute goes at `transitionend`, or after two frames if
    nothing moved.
  - Sampled at 0.1× after a 140 px drag, the offset fell monotonically (123 → 0 px, with −1 px of
    `fling` overshoot), with no step at the hand-off.
- **Detents:** every compact sheet still rests at its one detent (ADR-0033). The hand-off
  applies to snapping back to it and to closing.
- **Page swipe:** the reader scrolls natively, so a swipe keeps the platform's own momentum.
  Nothing in script fights it, and no snapping was added.
- **Top bar:** hide and show on scroll was already a `--spring-quick` transform transition, which
  a direction change retargets from where the bar is. It is unchanged.

The edition stays read-only.

## Not done

- **Progress (save, OCR, compress)** lives in `ui/Progress.tsx` and the toast's
  `ProgressCapsule`, which are `ui/` primitives this lane was told not to touch. Proposal for the
  platform lane:
  - Follow the throttled value with `animate()` on `smooth`, retargeting with velocity, and write
    `scaleX` to the fill.
  - For the indeterminate state, add a light shimmer band (`--loop-sweep`) over the existing
    sweep. Keep the pulse under reduced motion.
- **e2e:** no Playwright spec asserts the new motions yet. The A-9 and A-10 tour already pushes
  Settings, and `navPush` is within 1 % by 500 ms and fades only under reduced motion. Unit
  tests in `motion/feedback.test.ts` cover these limits.

Frame strips were recorded with Playwright at 0.1× animation rate, at 1440×900 and at 1180×820
with touch. They are kept outside the repo.
