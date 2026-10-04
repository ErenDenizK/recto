---
title: "ADR-0029: Viewing with targeted acts, one Markup state, Lock, and the Pages grid"
date: 2026-10-04
status: accepted
---

# ADR-0029: Viewing with targeted acts, one Markup state, Lock, and the Pages grid

**Status:** accepted 2026-10-04 by the owner, with the amendments of ADR-0033, `quality-bar.md` and `components/10-ink.md` · **Date:** 2026-10-04 · **Deciders:** project lead; the owner accepts ·
**Supersedes:** ADR-0019 §2–§5 (Read · Edit · Arrange, Read is locked, five Edit
groups, the Edit-mode policy); DESIGN §2's first bullet and its "In Read" tool-bar rows; DESIGN
§4.8's Read rows and "Pen draws in Edit"; DESIGN §5's "Modes and Edit (M8)" paragraph · **Keeps:**
ADR-0019 §1 (Home as a place, now the Library) and §6 (one hit order) · **Amends:** ADR-0020 (the
doors to the paragraph editor) · **Rests on:** `flows.md` §0–§1, §2.1–§2.6, §3, §4.2–§4.7, §7,
§11, §14 items 1, 5 and 6, §15 Q1; `language.md` §0.1 principle 8, §7.3; research 15 §5, RA-1
to RA-4, RA-7, RA-8, RA-21, RA-22; 19 M-17, M-19 to M-21, M-24, M-25; 18 MC-8, MC-9;
`current-flows.md` F-1, F-3, F-6, FL-R1, FL-R2, FL-R5, FL-R9; `inventory.md` INV-2, INV-3, INV-12

## 0. Summary

- A document opens in **viewing**, not locked. Acts aimed at a target (a field, a text
  selection, an annotation, the page menu, a thumbnail) work with no mode.
- **Markup** is the one creation state (dock, M or 2), always opened with Select armed; Done or
  Esc Esc closes it. Page text changes only in the paragraph editor.
- **Lock** is per document, with four reasons and an "Open documents locked" setting.
- Arrange becomes the **Pages grid**, a surface one 240 ms transition away; **key map v2**.
- Whether documents open locked stays the owner's choice. Either answer is one flag.

## 1. Context

ADR-0019 (accepted 2026-10-03) shows a document in Read (locked) or Edit, with Arrange as a
view. The flow audit measured the cost (F-1): the first highlight, stroke, fill, signature, text
edit or redaction needs a switch or a "Switch to Edit" notice, +1 step on six jobs (J5–J10).
Page structure escapes the lock: with a thumbnail selected, Shift+R rotates and Delete deletes a
page, also in Read (INV-3). Tools sit three levels deep (F-3); page operations live in four
places (F-6).

Research 15 §5: the reference apps make drawing an explicit state, but as a palette, not a mode
of the document (Preview's Markup and Done); fields, highlights and notes work without it, and
arranging pages is a view no app makes a peer of reading. The owner's M8 asks still hold: no
pen or stray click edits page text by accident, and a locked state exists. Of the three
proposals, A (a Markup toggle), B (no state, the pen writes by default) and C (eight tasks with
Done), the judges scored build A 53, C 40, B 31; owner C 53, A 51, B 46; power A 55, C 51, B 45.
`flows.md` builds A's model with C's surfaces (ADR-0031).

## 2. Decision

1. **Viewing** (`flows.md` §1, §3.1): reading plus the targeted acts. Type in a field, toggle a
   checkbox; Highlight, Comment (one Highlight with its note open), Underline, Strikeout, Redact or
   Edit text from the selection bar (RA-8); restyle, delete or move a selected annotation; the page
   menu with "Add … here"; drag a thumbnail. Each is one undo step, each removal a toast with
   Undo. A pointer that only lands changes nothing; nothing reacts to hover on text.
2. **Markup** (`flows.md` §4.2–§4.3): `docUi[id].markup`, the pressed state of the dock's labelled
   Markup. Doors: dock Markup (Draw set), Fill & sign (Sign set), M, 2, a tool key, "Mark area".
   It opens with Select armed; P arms the last pen, again the next; placing tools return to
   Select after one use. Esc disarms, a second Esc closes; Done or `1` closes. It lasts the
   session, never restores on launch, and morphs from the dock (ADR-0026 *bar morph*).
3. **Protection as input rules** (`flows.md` §3):
   - *Page text:* only the paragraph editor changes it. Doors: Edit text (selection bar, page
     menu, palette ¶); E on a selection outlines the paragraph and Enter opens it; a double-click
     in Markup with Select, by mouse or by a pen used as a pointer, never by touch. In viewing a
     double-click selects a word.
   - *Pen:* writes only in Markup by default; with Select armed it writes with the last pen once
     a pen has been seen (M-24, the M8 rule). "Pen writes without Markup" is opt-in, off. Ink
     never hit-tests text; a click under 2 px and 200 ms leaves no ink.
   - *Finger:* scrolls in viewing; draws in Markup only with "Draw with finger" (on until a pen is
     seen, M-25). Two- and three-finger taps undo and redo in Markup only (M-17).
   - *Keys on a selection:* H, U, S, C and X act once, one undo step each; E only outlines; any
     other key cancels and then acts as usual. Delete acts only on a visible selection.
   - ADR-0019 §6's hit order (annotation → form widget → image → text run → text selection) stays.

   Against `flows.md` §3.5's eighteen accidents: stricter for page text (S2–S4, S15), equal for
   the pen (S1); five deliberate acts become one visible, undoable step; S10's hole closes.
4. **Lock** (`flows.md` §2.6). Reasons: `user` (title-menu switch, ⌘K `lock`); `signed` (opens
   locked; unlocking warns once that saving removes the signature); `restricted` ("Restricted by
   the file · Unlock anyway"); `default` (the setting). It blocks every act of ADR-0030 and keeps
   reading, Find, copy, Review, the grid as a view, Extract, Save a copy, Compare, Undo and Redo.
   Shown by glyph and word, never tint (A-19): the tab glyph, the title-menu switch, one dock
   button **Locked** (replacing Markup and Fill & sign) that opens the Unlock popover, "Locked ·
   Unlock" on a field. No single key. Kept in the snapshot (ADR-0032), enforced in `commit()`.
5. **The Pages grid** (`flows.md` §2.1, §4.4): `docUi[id].surface: 'page' | 'grid'` replaces
   Arrange. In: dock Pages, `3`, ⊞, a pinch released > 15 % below fit page, Mod+wheel at fit page,
   a Combine result. Out: Done, Esc, `3`, double-click or Enter on a page. A 240 ms View
   Transition on release (MC-9). A click selects; scope This document | All open. Sidebar
   thumbnails drag (4 px mouse, 450 ms touch lift, M-20; a drop on a tab moves pages there, RA-7).
   Combine always makes a new document, keeps its sources and opens its grid (INV-12).
6. **Key map v2** (`flows.md` §7.2–§7.3): `0` Library · `1` viewing, never locks (a one-time
   toast) · `M` Markup, `2` alias · `3` grid · `4` Compare · tool keys open Markup and arm · H U S
   C X on a selection, E then Enter · Shift+R rotates, R is Rectangle everywhere · Enter on a page
   starts caret mode or places (arrows nudge) · Alt+Enter turns a Find hit into a selection · ⌘K
   arguments (`move 5 before 2`). Avoided: Mod+1…9 in a browser tab, `\` (Turkish AltGr), F7.
7. **State** (`flows.md` §2.4): `DocumentUi { surface, markup, paletteSet }`; `lock-store.ts`;
   `input-policy-store.ts` replaces `edit-policy-store.ts` (`penDrawsInEdit` migrates once to
   `penDrawsInMarkup`). `documentMode`, `setDocumentMode` and `lastView` go.
8. **The open owner question** (`flows.md` §15 Q1). "Open documents locked" defaults to off, as
   recommended. Both answers build the same code: on open the flag sets `locks[id] = 'default'`
   unless the document is already `signed` or `restricted`; Try the sample follows it; unlocking
   costs two presses (Locked, Unlock) once per document. With the flag on, every row of §3.5
   equals its right-hand column: ADR-0019's Read, made stricter. No code path reads the default.

## 3. Consequences

- Users relearn (`flows.md` §11): `1` no longer locks; Edit is Markup; R no longer rotates.
- Steps (`flows.md` §8.2): mouse ≈91 → 68 over 19 job rows; keyboard ≈121 → 81 over 16 rows, and
  J5 and J8A gain a keyboard path; touch ≈99 → 72 with every job possible; 3 Markup openings
  against 9 mode or view switches. No job gets worse.
- Five acts change an unlocked file in one step, each with Undo and a toast; S7 and S9 go into a
  five-person test on a form (judgement, `flows.md` §3.5).
- ADR-0020 is amended: three doors, the selection carried in, the double-click only in Markup.
- The `modes`, `tools`, `a11y` and `light-table` e2e specs are rewritten; `enterEdit` keeps
  working through `2`. Migration: 3–4 days of mechanical change (judgement, `flows.md` §2.4).

## 4. Alternatives considered

- **Keep ADR-0019's Read by default:** +1 step on six jobs; it remains one setting away.
- **Proposal B (no state, pen writes by default, hold-still-to-select, undo gestures while
  reading):** "a file opens untouchable" becomes opt-in and a resting pen marks the page; ranked
  last by all three judges. Its pending-marks bar, Combine into the grid and pinch below fit stay.
- **Proposal C (eight tasks with Done):** more hidden state (which task is open) and a step for
  Edit text and Redact; its top strip, dock and Library stay (ADR-0031).
- **Markup opening with the last pen (A as written):** breaks A's own J6 count and makes the
  double-click door a hazard; Select on opening plus P costs nothing for pen users.
- **The pen writes anywhere once seen (research 15 §5 item 3):** a reader's resting pen would mark
  the page (S1); kept as the opt-in setting. **A scrubbed pinch into the grid (B):** a View
  Transition cannot be scrubbed.
- **Tool-only text editing, or no double-click (power judge):** the owner asked for "click a text
  and type"; ADR-0019 rejected tool-only editing for that reason.
- **A single Lock key:** changes a permission with no visible act; Lock lives in the title menu.

## 5. Issues for the lead

1. **Lock also blocks whole-document operations** (page numbers, OCR, Apply redactions), since
   ADR-0030's `document` act is blocked when locked. ADR-0019's Read allowed them, so "Open
   documents locked" is stricter in two ways, not only page structure as `flows.md` §2.6 and §3.5
   say. Owner question 1 should name both.
2. **Lock while an editor is open.** Not covered by `flows.md`. This ADR decides: the Lock switch
   is dimmed while the paragraph editor or a note or text box is being typed in ("Finish editing
   first"); `signed` and `restricted` locks start only on open.
3. **ADR numbering.** `flows.md` §14's seven items map to four ADRs: items 1, 5 and 6 here, 2 to
   ADR-0030, 3 and 7 to ADR-0031, 4 to ADR-0032 (`language.md` §11.3 item 5).
