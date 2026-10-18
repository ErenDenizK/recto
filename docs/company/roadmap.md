# Roadmap

Owned by the CEO (PRC-24); re-ranked every Sunday. Ranked by value to the person using Recto per
unit of effort. An item moves to "Now" only with a done condition. Board items wait for the owner.

## Goal for the next two weeks

**Ready for the owner's user tests, then learn from them.** The build a tester meets must be the
most presentable one (B-16): nothing broken, nothing repeated, no slow frame on a mid phone. Then
the tests' findings outrank everything else here.

## Now (R23)

| # | Item | Role | Done when |
|---|---|---|---|
| 1 | GPU glass survives a pause: the slow-frame rule (GLS-13) restarts its clock after a pause, so a pause over 2 s no longer ends GPU glass for the session (PRC-22's open note) | builder + principal review | a unit test pauses 3 s and GPU glass keeps drawing; e2e glass specs green |
| 2 | Modal sheets and dialogs announce themselves as modal (`aria-modal`), so toasts pause under them and shortcut guards see them (DSN-56, A-24) | root cause, then builder | one helper decides "a modal is open"; toast and keymap specs cover a Base UI sheet |
| 3 | Presentability sweep: the design director walks every screen and sheet at desktop, tablet and phone, both themes | design director, then builders | a findings list in the HQ issue; every "send back" item fixed or ranked |
| 4 | User-test kit: tasks for desktop and phone, what to watch, a one-page findings template | strategist | `docs/research/user-tests/kit.md` reviewed by the CEO |
| 5 | Phone first-load: measure the PWA precache (13.45 MB at R22) and the first open on a throttled phone; cut what the first visit does not need | root cause, then builder | a measured number before and after, no gate raised |
| 6 | Stale task audit: old open items (XD-3 tracks, the R12 innovation roadmap) checked against today's code; each closed, merged into this list, or parked with a reason | analyst | this file updated |

## Next

- Findings of the user tests (they jump the queue when they arrive).
- Weekly routing comparison (Sonnet lanes against the Opus baseline, `model-routing.md`).
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
