# Roadmap

Owned by the CEO (PRC-24); re-ranked every Sunday. Ranked by value to the person using Recto per
unit of effort. An item moves to "Now" only with a done condition. Board items wait for the owner.

## Goal for the next two weeks

**Ready for the owner's user tests, then learn from them.** The build a tester meets must be the
most presentable one (B-16): nothing broken, nothing repeated, no slow frame on a mid phone. Then
the tests' findings outrank everything else here.

## Now (R24)

R23's eight items are done (#29–#46). Text (.txt) to PDF shipped in #47 (PRD-19).

| # | Item | Role | Done when |
|---|---|---|---|
| 1 | Office → PDF phase 2 plan: deploy ships the package, CI runs `office.spec`, isolation on Firefox and WebKit, font licences, a "Remove package" setting, font fidelity, flag-removal criteria | principal | `docs/research/conversion-2026-10/office-phase-2.md` with lanes and board questions |
| 2 | Office → PDF phase 2 lanes, as the plan sets them | builders + principal review | each lane's done condition; the flag comes off only by the plan's criteria |
| 3 | Office files open as new, unsaved documents, like Text to PDF (PRD-19): close warns, not in Recents | builder | a unit test and the office e2e cover it |
| 4 | Presentability leftovers from the sweep (#9, #10, #13, #14, #16–#23, #25) | builders + design director | each fixed or parked with a reason |
| 5 | Markdown to PDF with a small built-in parser (conversion memo step 2) | principal plan, then builder | headings, lists, emphasis, code and links render; text extracts back |

## Next

- Findings of the user tests (they jump the queue when they arrive).
- The ~60 remaining test waits that need app hooks (after the #46 sweep).
- Phone first-load proposals P1–P6 (some need PF-17 and MOB-13 amendments).
- Weekly routing comparison (builder lanes against the judge baseline, `model-routing.md`).
- Accessibility pass on keyboard and focus (PRD-3: not a V1 requirement, but cheap wins count).
- Settings and Library copy read in Turkish by a native-quality reviewer pass.

## Parked (owner)

- Dark pages through PDFium (MOB-16 step 2). The About video reshoot. About itself (B-14).

## Board ideas (proposals, not decisions)

- **Verifiably private.** Recto is already public under Apache-2.0. Make that the headline: a page
  that shows the app making no network request with a file open, and a build hash anyone can
  reproduce. Competitors say "private"; Recto could prove it.
- **Launch once the user tests pass:** a short public launch (a Show HN style post, a 30 s video).
  Speaking in public is the board's call.
- **The glass as a family asset:** the materials and motion tokens packaged for the owner's other
  products (`docs/family/`), so each new product starts with Recto's look.
