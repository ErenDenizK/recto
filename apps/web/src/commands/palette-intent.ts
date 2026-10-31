/**
 * The palette's door to the intent bar (PRD-39, spec §2.12–§2.14, lane N3): what the typed text
 * reads as (`readIntent`: the parser's readings, each with its preview), whether a row on screen
 * is still the one Enter would run (`stillShown`, §2.13), and how it runs (`runReading`). Nothing
 * here is a second home for a command (DSN-46): the runner executes the same commands the menu
 * and the keys use, so Undo toasts, guards and announcements are the commands' own.
 *
 * The palette loads this module lazily, with the parser, the preview, the runner and the rows'
 * component, so none of it enters the editor's first load (PRD-39, spec §2.19).
 */
import { gatherIntentContext, workspaceVersion } from './intent/context';
import { parseIntent } from './intent/parse';
import { type IntentPreview, previewOf, previewWithGuard } from './intent/preview';
import type { RunResult } from './intent/run';
import type { Reading } from './intent/types';
import { m } from '../i18n';

// One chunk for the parser, the preview and the runner, and the component that draws them.
export { IntentReading } from '../shell/palette/IntentRows';
export { gatherIntentContext, parseIntent };
export type { IntentPreview, RunResult };

/** One reading as the bar shows it: the reading, its preview and the text it was drawn from. */
export interface ReadingRow {
  /** The preview's key: the folded text, the steps and the workspace version (§2.13). */
  readonly key: string;
  readonly reading: Reading;
  readonly preview: IntentPreview;
  /** The exact text typed, which `runReading` checks the key against. */
  readonly text: string;
}

export type IntentRead =
  /** One or two readings, best first. */
  | { readonly kind: 'readings'; readonly rows: readonly ReadingRow[] }
  /** An action word was found but another word was not: a quiet row, then the commands. */
  | { readonly kind: 'partial'; readonly message: string; readonly rest: string }
  | { readonly kind: 'none' };

/** "Try: rotate pages 3–5 right", in the UI language (§2.14). */
export function exampleLine(): string {
  return m.intent_bar_try({ example: m.intent_bar_example() });
}

/** What `text` reads as against the open document now (§2.2, §2.11). */
export function readIntent(text: string): IntentRead {
  const ctx = gatherIntentContext();
  const result = parseIntent(text, ctx);
  if (result.kind === 'none') return { kind: 'none' };
  if (result.kind === 'partial') {
    return {
      kind: 'partial',
      message: `${m.intent_bar_not_understood({ word: result.unknown[0] ?? text.trim() })} · ${exampleLine()}`,
      // The commands rank on what was understood: the text without the words it did not read.
      rest: text
        .split(/\s+/)
        .filter((word) => !result.unknown.some((u) => u.toLowerCase() === word.toLowerCase()))
        .join(' '),
    };
  }
  const version = workspaceVersion();
  return {
    kind: 'readings',
    rows: result.readings.map((reading) => {
      const preview = previewWithGuard(reading, ctx, version, text);
      return { key: preview.key, reading, preview, text };
    }),
  };
}

/**
 * Whether `row` still describes the document and the text now. Enter checks this before the
 * palette closes, so a stale row does nothing at all (§2.13 c); `runReading` checks it again.
 */
export function stillShown(row: ReadingRow): boolean {
  return (
    previewOf(row.reading, gatherIntentContext(), workspaceVersion(), row.text).key === row.key
  );
}

/** The screen reader's sentence for the readings on screen (FB10, `palette-args`; §2.15). */
export function announcementOf(read: IntentRead): string | undefined {
  if (read.kind !== 'readings') return undefined;
  const [first, second] = read.rows;
  if (first === undefined) return undefined;
  const say = (row: ReadingRow) =>
    row.preview.reason !== undefined && row.preview.reason !== row.preview.sentence
      ? `${row.preview.sentence}. ${row.preview.reason}`
      : row.preview.sentence;
  return second === undefined
    ? say(first)
    : m.intent_bar_announce_two({ first: say(first), second: say(second) });
}
