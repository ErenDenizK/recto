---
name: decision-rows
description: Adds, renumbers or supersedes a row in Recto's decisions log (docs/process/decisions.md index plus decisions/<area>.md) without id clashes between parallel lanes. Use when a lane records a decision, when a brief assigns decision ids, and when merging develop shows a conflict or a duplicate id in the decisions files.
---

# Decision rows

Parallel lanes each took "the next free id" from the same `develop` and clashed (R22–R29: TXT-22,
DSN-68/69 and PRD-24 renumbered after the fact, a duplicated PRD-30 index line left by a merge).
The id is claimed when the brief is written, not when the row is.

## The lead, writing briefs

- Before hiring parallel lanes, read the last id of each area they may record in
  (`grep -o '^| [A-Z]*-[0-9]*' docs/process/decisions/<area>.md | tail -1`) and give each lane its
  own ids in the brief: "Decision ids reserved: DSN-80, DSN-81."
- Keep a reserved id even if the lane records nothing; a gap is fine, a clash is not.

## The lane, recording a row

1. Use only the ids your brief reserved. None reserved and you must decide: stop and ask
   (implementer), or take the area's last id on a fresh `git fetch origin develop` plus one and say
   so in the report.
2. Full row in `decisions/<area>.md`: `| ID | **Rule in bold.** Detail. | date | source | status |`.
   The source names who decided ("owner, 2026-10-26" or "lead, owner's delegation (PRC-24)").
3. Its one line in `decisions.md`, in that area's table:
   `| [ID](decisions/<area>.md) | decision in at most 120 characters | status | date |`.
4. A row it replaces: status "Superseded by ID" in both files. Never delete or reword old rows.
5. Append only; never reorder, split or rewrite the tables (clean-up lanes do that, last).
6. Run `node --experimental-strip-types --no-warnings=ExperimentalWarning tools/qa/decisions-index.ts`.

## After merging develop

- A conflict in `decisions.md` or an area file: keep both sides' rows, in id order, each once.
- Same id, two different decisions: the branch that merges second renumbers its own row to the
  area's next free id, then greps the old id across the branch (`grep -rn 'DSN-68' docs apps`) and
  fixes every mention: doc comments, specs, the PR body.
- Rerun the index check. It catches duplicates and missing lines, not a wrong reference in prose.
