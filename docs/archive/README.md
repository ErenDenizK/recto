# Archive

Documents that are finished or superseded, kept as the record. Nothing here describes how Recto
works today: the live sources are `docs/process/decisions.md` (it wins over every older doc), the
specs in `docs/specs/` and the ADRs in `docs/adr/`. Paths below mirror where each file used to
live, so `docs/archive/<old path>` is the file that was at `docs/<old path>`.

| File | What it was | Why it is here |
|---|---|---|
| [`DISCUSSION.md`](DISCUSSION.md) | The open-decisions list from M0 to M8 (items 1–34) | Closed on 2026-10-04; new decisions go to `decisions.md`. ADRs and specs still cite its item numbers ("#28"), which stay valid here. |
| [`process/handoff-2026-10-15.md`](process/handoff-2026-10-15.md) | One lead session's hand-off for the text editing, phone and sample work (2026-10-12 → 15) | The owner approved its work on 2026-10-15; its decisions are rows in `decisions.md` (MOB-*, TXT-*), and the briefs since (`docs/process/brief-2026-10-16.md`, `brief-2026-10-17.md`) carry what it left open. |
| [`plan/v1/old-roadmap-inventory.md`](plan/v1/old-roadmap-inventory.md) | R13's inventory of ideas left over from the earlier roadmap (2026-10-09) | Folded into `docs/plan/v1/PLAN.md` and `feature-decisions.md`, which the owner decided row by row. |

Moved here in R22 (brief C-9, work package D1, 2026-10-17). `docs/ROADMAP.md` stays where it is
although it is superseded from M9 on: the app's About page, the release notes and the issue
template link to it.

## Screenshots removed from the tree (D4)

Superseded audit screenshots (154 files, 13.1 MB) were deleted from the working tree rather
than moved here: a copy inside the repository weighs the same, and history keeps every file
either way, so the clone does not shrink. Their write-ups stay in place and link each image at
commit `2be6e68`:

- `docs/design/audit/` and `audit/pass/`: the M4 refinement audit (2026-09-28).
- `docs/design/audit-2026-10/`: the M5 experience audit's eight frames and the M6 V1 results.
- `docs/design/system-audit-2026-10/`: the visual system audit's captures (2026-10-09).

To get one back: `git show 2be6e68:docs/design/audit/01-empty.png > 01-empty.png`.

