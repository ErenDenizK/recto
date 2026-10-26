---
title: "Handoff to the text-editing workstream: what the PdfCraft study suggests"
date: 2026-10-26
status: proposal
---

> From research 25 ([`../25-artcraft-pdf.md`](../25-artcraft-pdf.md)). Proposals, not decisions:
> the TXT lane and the lead decide, the owner decides the look. Under ART-1 nothing here comes
> from PdfCraft's code or from Acrobat internals; each item is described from Recto's own
> pipeline and can be built and tested from it.

# Text editing: proposals from the PdfCraft study

## H-1. Every paragraph visible while Edit text is on (research 25, P1)

**Today.** `TextEditLayer` gets the page's paragraphs from `analyzeParagraphs` on arming; only the
hover outline shows.

**Proposal.** On arming, draw one quiet box per detected paragraph that does not refuse paragraph
mode (the same set as the keyboard targets), on every page in view. The open paragraph's box is
hidden under its editor. Refused runs keep today's hatch on hover. Past a cap (start at 250 boxes
a page) draw only hovered and focused boxes; hit-testing is unchanged. A setting turns the boxes
off (wording in `en.json` and `tr.json`). The box's colour, weight, radius and entrance are the
owner's taste; reduced motion shows them at once.

**Tests.**
- Unit: the boxes rendered equal the paragraph targets (`layerItems`) for the sample's feature
  page; above the cap only the hovered box renders.
- Browser: arming E on the sample shows N boxes within one frame of the paragraphs settling
  (`settled(el)`); the open editor's box is absent; turning the setting off removes them.
- Budget: arming on the perf fixture's dense page adds no long task over 50 ms on the main thread
  at 1440 × 900 (production build).

## H-2. Pre-analysis on by default (research 25, P2)

**Today.** TXT-22 behind `?textpre=1`; measured 675–1244 → 117–130 ms click to caret on desktop,
1286–1523 → 415–447 ms on the tablet profile.

**Proposal.** After the iPad check TXT-22 asks for, make it the default. Then, at idle and only
after the page in view is done, analyse the next page in reading direction, under a budget
(for example 32 paragraphs or 2 s of worker time a page), stopping on scroll, revision change or
tool exit, as today.

**Tests.** The existing TXT-22 measurement script, repeated with the flag removed; a render
request waits behind at most one paragraph analysis (assert in the worker queue test); main
heap after forced GC stays within +8 MB on the sample.

## H-3. Move and resize a paragraph (research 25, P3)

**Proposal.** In Edit text, a drag on a paragraph's box (not on its text caret area once open)
moves the paragraph; a handle on each side rewraps it to a new width at the same size. The engine
needs a translate edit for a paragraph's objects that moves links, markup and widgets on its
words (as the writer already does for moved lines) and records itself for replay (ADR-0011);
width changes reuse `layoutParagraph` with a new width and the overflow policy. Handles only on
upright and upside-down pages at first.

**Tests.** Engine: translate by (dx, dy) moves every glyph origin by exactly that vector, keeps
text and clip, moves a link on a word; replay writes the same bytes. Width: halving a paragraph's
width doubles its line count on a fixture and the verification passes. Browser: drag moves the
box and the rendered text; Undo restores both.

## H-4. The file's own full font for missing letters (research 25, P4)

**Proposal.** When a style's font program is embedded in full (no subset tag, glyph count covers
the cmap) and its OS/2 `fsType` allows editable embedding, write characters its encoding cannot
show with that program (a new Type 0 / CID object on the same program) before the bundled
substitute. Otherwise behave as today.

**Tests.** A fixture with a fully embedded TrueType (Latin, simple encoding) where typing `ğ ş ı`
writes them in the original face (font name in the new object equals the source's, extraction
reads back the letters); a restricted `fsType` falls back to the substitute; a subset font is
unchanged.

## H-5. Smaller items

- **Defer the plate** (P7): open without the dry-run plate; render it on the first change. Test:
  opening and closing with Esc runs no dry run (worker call count).
- **OCR text** (P6, owner decision first): cover with the paper colour sampled round the words
  (`viewer/page-pixels.ts`), write visible text; today such runs are refused as `invisible`.
- **Corpus sweep** (P5): locate + detect over a public corpus nightly, no crash and a time bound
  a page; reading-order score against a reference extractor recorded per run.
