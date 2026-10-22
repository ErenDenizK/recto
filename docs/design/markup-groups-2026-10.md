# A markup row people can read (epic R25-7, board question 3)

The Markup row today is about twenty wordless icons (`03-markup` MK-2). Two layouts were tried. Both are
behind a flag that sticks per device (`markup/palette-variant.ts`, as `office/flag.ts` does):
`?palette=groups`, `?palette=labels`, and `?palette=row` to go back. The default row is unchanged.

## (A) Four labelled groups: built (`?palette=groups`)

`✓ Done │ ↖ │ ✎ Draw ● ● ● ▬ ⌫ ◌ ▭ │ 💬 Comment │ ✑ Fill & sign │ ▤ Change page │ +`

- Draw (pens, highlighter, eraser, lasso, shapes) · Comment (note, text box, stamp, image) · Fill &
  sign (sign, saved signatures, fields; named as its door, one task one name) · Change page (edit
  text, redact; TR "Sayfayı düzenle"). One group is open at a time, its tools in place after its
  name. Pressing another name opens it, and the capsule morphs to the new row (MK-1,
  `shell/capsule/content-morph.ts`); reduced motion gets the cross-fade.
- Markup opens on Draw, so a pen is still one press (INK-2); Fill & sign opens its own group. A tool
  armed by its key, ⌘K or + opens its group. Keys stay INK-7.
- The armed tool shows its name: Draw reads "Eraser" or "Rectangle", Comment reads "Note" (the
  highlighter's swatch names itself, so Draw keeps its name). The open group's names share one grid
  cell, so nothing moves under the hand; a closed group takes only its own name's width.
- Fold: the closed groups' names go first, then Done's label, then MK-2's steps for the open group.
  At 1180, 1366 and 1440 nothing goes under +.

## (B) A labelled single row (`?palette=labels`, a mock for comparison)

Today's row, with a name beside each tool, dropped from the end as width runs out. At 1440 it fits 11
names. At 1366 touch it fits 6 and at 1180 touch only 3 (Done, Select, Eraser). On the tablet the row
goes back to unlabelled icons, which is the problem the epic set out to fix (audit friction #5).

## Why A

A stays readable at every size because it shows at most 4 names and 3–5 tools. B only reads well on a
wide desktop. A costs one extra press for a tool outside Draw used with the mouse, and keys cost
nothing extra. A also brings back M6's labelled groups (DSN-7's concept) inside one capsule (Q-9). The
board picks: try A on the iPad and let the user tests decide (DSN-59).

**Screenshots** (scratchpad): `r25-markup2-groups-{1440,1180-touch,1366-touch}-{light,dark}.png`, `…-light-comment-armed.png`
(Note armed, capsule at Comment's width), `…-{1440,1180-touch}-light-tr*.png` (TR: four names fit, no fold).

## Presses to each user-test-kit tool (`research/user-tests/kit.md` D2–D6)

Counted from viewing with a file open. Each count is a press, tap or drag, and typing is not
counted. The tablet counts are the same, because neither layout folds a kit tool into + at 1180.

| Task                                 | Today's row: pointer                                         | Groups: pointer             | Keys (both)                 |
| ------------------------------------ | ------------------------------------------------------------ | --------------------------- | --------------------------- |
| D2 highlight + note                  | 5: Markup · Highlighter · drag · Note · place                 | 6: + Comment before Note    | 4: H · drag · N · place     |
| D3 edit a word                       | 3: Markup · Edit text · the word                              | 4: + Change page            | 2: E · the word             |
| D4 fill and sign (first signature)   | 5: Fill & sign · Sign · draw · Use signature · place (+ fields) | 5: the door opens its group | 4: G · draw · Use · place   |
| D5 last page first                   | 2: Pages · drag                                               | 2 (not on the row)          | 2                           |
| D6 redact and apply                  | 5: Markup · Redact · drag · Apply · confirm                   | 6: + Change page            | 4: X · drag · Apply · confirm |

The cost of A is +1 on D2, D3 and D6 with the mouse, and 0 by keys or on D4 and D5. On today's row the
press count is lower, but the tool must first be found among twenty icons with no names. That search
is what test goal 2 measures, and the SEQ and time per task will show which layout wins.

**Checks.** `markup.spec.ts`, `capsule.spec.ts` and `bar-audit.spec.ts` run on both palettes
(`PALETTES`, `e2e/helpers.ts`) on Chromium and the tablet. They also check that a name opens its group by
press, tap or keys, that a tool's key opens its group and names the tool there, and that the group
change morphs (a cross-fade under reduced motion). Unit tests: `markup/task-groups.test.ts`.
