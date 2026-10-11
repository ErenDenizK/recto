/**
 * The list drawer's rows (EDN-16; `ToolList.tsx`): the owner's "one tap selects; a second tap
 * expands it a bit more and the colour and the other details come underneath, row by row".
 * Pure, so the accordion's rules are tested apart from the panel:
 *
 * - A tap on a row that is not the armed tool arms it (the row becomes current) and folds any
 *   open row: only the current row can be open.
 * - A tap on the current row opens its options under it, and a tap on the open row folds it.
 *   A row with nothing to show (no options, no hint) never opens.
 * - A "Soon" row does nothing.
 * - When the tool changes elsewhere (Select in the quiet row, the chip), an open row that is no
 *   longer current folds (`openRow`).
 */
import type { CompactTool } from '../compact-store';

export interface ListRow {
  readonly id: CompactTool;
  /** Shown but not armable yet (Edit text until WP5). */
  readonly soon?: boolean;
  /** It has options or a hint to open under it. */
  readonly opens: boolean;
}

export interface ListTap {
  /** The tool to arm, if the tap arms one. */
  readonly arm: CompactTool | null;
  /** The row open after the tap. */
  readonly open: CompactTool | null;
}

/** What a tap on `row` does, with `tool` armed and `open` the open row. */
export function tapRow(row: ListRow, tool: CompactTool | null, open: CompactTool | null): ListTap {
  if (row.soon) return { arm: null, open: openRow(tool, open) };
  if (row.id !== tool) return { arm: row.id, open: null };
  if (!row.opens) return { arm: null, open: null };
  return { arm: null, open: open === row.id ? null : row.id };
}

/** The open row as the armed tool allows it: only the current row stays open. */
export function openRow(tool: CompactTool | null, open: CompactTool | null): CompactTool | null {
  return open !== null && open === tool ? open : null;
}
