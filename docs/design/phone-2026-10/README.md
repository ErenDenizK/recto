# Phone editing (M10): the edit island and the tool drawer

**Status:** accepted by the owner on 2026-10-11 (decisions EDN-7, EDN-8, EDN-9). This is the
brief every phone-editing work package builds from.

**Rests on:**

- `research/phone-2026-10/ux-references.md`: architecture A, recommended.
- `code-audit.md`: reuse map, bundle plan, work packages.
- `visual-audit.md`: phone defects.
- ADR-0033: the compact edition.
- `redesign-2026-10/language.md`: glass tiers and motion.
- `motion-2026-10/platform.md`: the container transform.

## 1. What the owner asked for

> Full minimalism and simplicity. We can't offer every desktop tool on a phone. As compact,
> simple, automated and touch-friendly as possible: maybe only two or three actions in the
> bottom bar, the rest from a pop-up or a drawer.

On the drawer specifically:

> Make the drawer superb as a design, not a makeshift drawer. Maybe a floating glass object
> that rises from below. Work on it very carefully.

The tools are pen, highlight, adding text, signature and, last, editing text (EDN-8). Nothing
else from the desktop palette comes to the phone in M10.

## 2. The shape

**Reading (unchanged, plus one button).**

- The phone's capsule keeps Pages · `n / N` · Find.
- A round ✎ button sits beside it, on the trailing side.
- This follows the iOS 26 pattern: a tab bar with a separate trailing "island".
- The ✎ button hides with the chrome on scroll and comes back with it.

**Editing.** Tapping ✎ morphs the capsule (the same signature as the full edition's capsule,
quality bar Q-6) into the edit island. The island holds three fixed slots that never move:

| Slot | Content | Tap | Long-press / ▾ |
|---|---|---|---|
| Leading | Undo (Redo appears after an undo) | undo | history is not shown on phones |
| Centre | The current tool chip: glyph, one-word label and a ▾ | toggles the tool on or off (off = pan and select) | opens the **drawer** |
| Trailing | Done (lime, the view's one primary action) | leaves editing and flushes the session | — |

The first entry opens on Pen, and later entries open on the last tool used. A stylus draws at
once in any state; with a stylus present, a finger pans.

## 3. The drawer, a floating glass object

The drawer is the one place where all of phone editing lives, so it gets the most care.

- **What it is.** A floating M4 glass panel inset from the screen edges (16 px sides, above the
  island, clear of the home indicator), corner radius `--radius-xl`, concentric with the
  island. It is a separate object, never a full-width sheet glued to the bottom edge.
- **How it moves.**
  - It rises from the tool chip by the container transform (MOT-5): it grows out of the chip's
    rounded rect and closes back into it.
  - The island stays put.
  - It never covers the page above roughly 55 % of the screen height.
  - Reduced motion: opacity only, at most 150 ms.
- **Contents, in at most three rows:**
  1. **Tools:** Pen · Highlight · Text · Sign · Edit text, as large tiles (glyph plus label, at
     least 56 px), with the current tool filled.
  2. **The current tool's options:**
     - Pen and highlight: three colour swatches and three sizes. These are presets, never a
       picker.
     - Text: size S/M/L and colour.
     - Sign: the saved signatures as tiles, plus "New".
  3. **Quiet actions:** Eraser, Redo, Select (Undo is the island's, in reach under the drawer).
- **Closing** (EDN-18). A tap on a tool arms it and the drawer stays open, so another colour,
  size or tool is one more tap, and the island's Undo and Redo, in reach under the drawer, work
  with it open. Its head (grabber, "Tools", Done) gives Done. It closes by Done, swiping down,
  tapping outside or tapping the chip again; New signature closes it as its pad opens.
  - A tap outside only closes the drawer while Pen, Highlight, the Eraser or Select is armed,
    so putting it away never leaves ink.
  - Where the armed tool's next step is on the page (Text, Edit text, a chosen saved
    signature), the first tap on the page closes the drawer and acts: it places the box with
    the keyboard up, opens the paragraph, or places the signature.
- **Glass rules.** There is no glass inside glass, so the tiles are fills. A solid twin is used
  under Glass Solid. The aura shows through the glass and is never cut (DSN-24).
- **Feel.**
  - One spring (`smooth`), no bounce.
  - The arming tile answers with the receive pulse (MOT-5).
  - The chip's glyph cross-fades to the new tool under the open drawer, so the eye sees where
    the choice went.

## 4. Automation (shortcuts that skip the drawer)

- **Long-press on text** brings up a compact bar: Highlight · Edit text · Copy. It is lazy and
  must not fight the iOS callout. Highlight and Copy work even outside editing.
- **Tapping a form field** starts typing, and **tapping a signature field** opens Sign.
- **Placing a text box** opens the keyboard at once, and the box is kept above the keyboard
  (visualViewport).
- **Placing a signature** selects it, with handles sized for touch.

## 5. Touch rules in editing

- One finger draws with the armed pen or highlighter.
- Two fingers pan and zoom, and never draw. A second finger drops a stroke in progress.
- A tap is never misread as a dot, and a dot never toggles the chrome.
- The chrome does not hide on scroll while editing.

## 6. Saving

- There is no save in place on phones. Done keeps the changes on the device (snapshot,
  `flushSession`).
- A "Changed" cue offers Share or Save a copy.
- The copy cache is keyed on the edits, so Share never sends a stale copy.

## 7. Budget and order

- **Budget.**
  - The compact gate stays at 320 KB (PRC-11).
  - The static path gains only the ✎ button, the mode fields and an overlay slot.
  - Editing loads from `shell/compact/mark/` by `import()` and is prefetched when the browser is
    idle.
  - Text editing, signatures and the selection bar are split again.
- **Order.**
  1. WP0, phone fixes and headroom.
  2. WP1, the island, the drawer, the bridge and the gesture rules.
  3. Three parallel lanes: B pen and highlight, C adding text, D signature.
  4. WP5, editing text, last, after a hand check on an iPhone.
  5. QA throughout.
  6. The sample is rewritten for phones once editing ships (EDN-9).
