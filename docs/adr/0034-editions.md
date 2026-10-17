---
title: "ADR-0034: Editions: the full app on desktops and tablets, an editable phone edition, desktop later"
date: 2026-10-17
status: accepted
---

# ADR-0034: Editions: the full app on desktops and tablets, an editable phone edition, desktop later

**Status:** accepted · **Date:** 2026-10-17, recording the owner's decisions of 2026-10-09 and
2026-10-11 · **Deciders:** the owner (EDN-1 to EDN-3, EDN-7, EDN-8, in conversation); project
lead · **Amends:** ADR-0033 (§0, §2.3, §2.5 and §3's honesty line: the phone edition is no
longer read-only), ADR-0007 (desktop is a planned later edition of the same build, not only an
escalation path) · **Rests on:** `docs/process/decisions.md` EDN-1 to EDN-18 and MOB-1 to
MOB-18; `docs/plan/v1/editions.md`; `docs/research/phone-2026-10/`;
`docs/design/phone-2026-10/README.md`

## 0. Summary

- **Three editions, one build, no fork (EDN-1).** *Recto Web* is V1: desktop browsers and
  tablets, browser-only, nothing installed (EDN-2). *Recto on phones* is the same web build at
  the same URL with its own shell. *Recto Desktop* comes later, as a build target with the same
  UI and a few desktop-only features (EDN-3).
- **Desktops and tablets get the full app** (EDN-6) and come first. ADR-0029 to ADR-0032
  describe it.
- **Phones get the compact edition, editable since EDN-7.** It stays radically simple and
  touch-first: a reader with a bottom capsule, and an edit island with a few tools in compact
  form (pen, highlight, adding text, editing text, signature), plus form filling and a page
  overview. It does not aim at desktop tool parity.
- The device rule that picks the shell is ADR-0033 §2.1, unchanged.

## 1. Context

ADR-0033 (2026-10-04) gave phones a read-only reader so that M9 could finish the widescreen
app first, and left the phone's real design to M10 with the owner. On 2026-10-09 the owner
named three editions (web, desktop, phone) from one build, and the R13 study
(`docs/plan/v1/editions.md`) promised an ADR for them. On 2026-10-11 the owner opened M10 (in
translation, condensed): the phone becomes editable, radically simple, full minimalism and
touch first; a bottom bar of two or three actions, everything else in a pop-up or a drawer;
keep pen, highlight, adding text, editing text and signature; other tools may be dropped on
phones (EDN-7). Research came first (`research/phone-2026-10/`), then the work packages
recorded as EDN-8 to EDN-18 and, from the 2026-10-14 phone brief, MOB-1 to MOB-18. That work
has shipped, so ADR-0033's "read-only" no longer describes the product.

## 2. Decision

1. **Vocabulary** (`editions.md` §2). *Edition* is the product word: Recto Web, Recto on
   phones, Recto Desktop. In code, the build-time distribution is the *target* (`web`, later
   `desktop`; `__TARGET__`) and the run-time device UI is the shell, still named `Edition`
   (`'full' | 'compact'`, `shell/frame/edition.ts`). `?edition=`, `data-edition` and the session
   key keep their names for tests and support links.
2. **Choosing the shell.** ADR-0033 §2.1 stands: compact when the primary pointer is coarse and
   the screen's shorter side is under 600 CSS px, read once per launch, `?edition=compact|full`
   to override. Tablets, touch laptops and every desktop window run the full app.
3. **The full app** is the web target with the full shell: everything ADR-0029 to ADR-0032 and
   the redesign spec describe, built and tested for desktops and tablets first (EDN-2, EDN-6).
   Its narrow-window layouts stay for 400 % zoom (ADR-0033 §2.2).
4. **The phone edition** is the web target with the compact shell (`shell/compact/`). It reuses
   the viewer, engine, stores and the full app's tools and commits, unforked; only the chrome is
   its own.
   - **Reading:** the reader, the Library, Pages, Find and the ⋯ sheets, as ADR-0033 §2.3 set
     them, with the sheets loaded on demand (EDN-10).
   - **Editing** (`shell/compact/mark/`): ✎ turns the capsule into an edit island (Undo · tool
     chip · Done) with the tool off, so one finger still scrolls (EDN-8, MOB-18); the chip's
     drawer arms Pen, Highlight, Text, Edit text (whole paragraphs) and Sign (EDN-11 to EDN-14,
     EDN-17). The drawer stays open on a tap (EDN-18); its tile and list forms are both built
     until the owner picks one (EDN-16).
   - **Forms and pages:** form fields fill by a tap, in reading too (MOB-1, MOB-5, MOB-6); a
     pinch out opens a page overview that selects, reorders, rotates, deletes, adds pages and
     shares extracts (MOB-2, MOB-3, MOB-7 to MOB-9).
   - **Saving:** a changed document says so and offers Share a copy and Save a copy (EDN-14);
     snapshots restore as in ADR-0032.
   - **Not on phones:** tools beyond these five, tabs (one document at a time), Compare,
     conversions and the desktop sheets. The Library says what the phone can do (EDN-15).
   - Rarely used and editing code loads on demand, so the static phone path stays small
     (EDN-10, PRC-11).
5. **Recto Desktop comes later** (EDN-3): a `desktop` target of the same UI, a superset of the
   web edition, holding the features that need persisted identity, network beyond the app's
   origin, heavy native or model components or OS integration (`editions.md` §0, §6). Until it
   starts, only the cheap guards that protect the web are built: the `__TARGET__` define, the
   ED-2 lint fences and the bundle budgets. Its technology and design get their own ADR when the
   owner opens that work.

## 3. Consequences

- ADR-0033 keeps the device rule and the record of the read-only interim; its title and status
  point here.
- Tests: the `phone` and `phone-land` Playwright projects cover reading and editing on the
  compact shell; the `tablet` project runs the full app (ADR-0033 §3).
- Two shells stay in step through shared code: a fix to a tool, the stores or the engine reaches
  both. A phone-only behaviour lives in `shell/compact/` and must not leak into the full shell.
- The phone sample (`recto-sample-phone-{en,tr}.pdf`, MOB-12) teaches only what a phone can do
  (EDN-9).
- Code comments that still describe the compact edition as read-only (for example
  `shell/frame/edition.ts`) are corrected when their lanes next touch them.

## 4. Alternatives considered

- **Keep phones read-only until after V1** (ADR-0033 as written): the owner opened M10 instead
  (EDN-7), once the widescreen app was in hand.
- **Desktop tool parity on phones:** rejected by the owner; the phone keeps the five jobs a
  person does with a finger and sends the rest to a computer or tablet.
- **A separate phone app or build:** one build at one URL keeps a fix in one place; a packaged
  phone app is out of scope until the owner asks (`editions.md` §10).
