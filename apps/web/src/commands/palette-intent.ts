/**
 * The palette's door to the intent bar (PRD-39, spec §2.12–§2.14, lane N3): what the typed text
 * reads as (`readIntent`: the parser's readings, each with its preview), whether a row on screen
 * is still the one Enter would run (`stillShown`, §2.13), and how it runs (`runReading`). Nothing
 * here is a second home for a command (DSN-46): the runner executes the same commands the menu
 * and the keys use, so Undo toasts, guards and announcements are the commands' own.
 *
 * The palette loads this module lazily, with the parser and the rows' component, so none of it
 * enters the editor's first load (PRD-39, spec §2.19). The preview (`intent/preview.ts`) and the
 * runner are two more lazy chunks: the palette loads the preview when a reading appears, and hands
 * it in (`withPreviews`, `stillShown`), so this module imports it as a type only and the bar's
 * first open does not pay for it.
 */
import { gatherIntentContext, workspaceVersion } from './intent/context';
import { parseIntent } from './intent/parse';
import type { IntentPreview, previewOf, previewWithGuard } from './intent/preview';
import type { RunResult } from './intent/run';
import type { IntentContext, Reading } from './intent/types';
import { m } from '../i18n';

// One chunk for the parser and the component that draws the readings.
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

/** The preview chunk's two functions, loaded by the palette when a reading appears (§2.19). */
export interface Previews {
  readonly previewOf: typeof previewOf;
  readonly previewWithGuard: typeof previewWithGuard;
}

/** What the parser made of the text, before any preview: the readings and what they read against. */
export type IntentParsed =
  /** One or two readings, best first, with the context and version they were read against. */
  | {
      readonly kind: 'readings';
      readonly readings: readonly Reading[];
      readonly ctx: IntentContext;
      readonly version: number;
      readonly text: string;
    }
  | Exclude<IntentRead, { readonly kind: 'readings' }>;

export type IntentRead =
  /** One or two readings, best first, each with its preview. */
  | { readonly kind: 'readings'; readonly rows: readonly ReadingRow[] }
  /** An action word was found but another word was not: a quiet row, then the commands. */
  | { readonly kind: 'partial'; readonly message: string; readonly rest: string }
  | { readonly kind: 'none' };

/** "Try: rotate pages 3–5 right", in the UI language (§2.14). */
export function exampleLine(): string {
  return m.intent_bar_try({ example: m.intent_bar_example() });
}

/** What `text` reads as against the open document now (§2.2, §2.11), without the previews. */
export function readIntent(text: string): IntentParsed {
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
  return {
    kind: 'readings',
    readings: result.readings,
    ctx,
    version: workspaceVersion(),
    text,
  };
}

/** The parse with each reading's preview drawn, once the palette has the preview chunk (§2.13). */
export function withPreviews(parsed: IntentParsed, previews: Previews): IntentRead {
  if (parsed.kind !== 'readings') return parsed;
  const { readings, ctx, version, text } = parsed;
  return {
    kind: 'readings',
    rows: readings.map((reading) => {
      const preview = previews.previewWithGuard(reading, ctx, version, text);
      return { key: preview.key, reading, preview, text };
    }),
  };
}

/**
 * Whether `row` still describes the document and the text now. Enter checks this before the
 * palette closes, so a stale row does nothing at all (§2.13 c); `runReading` checks it again.
 */
export function stillShown(row: ReadingRow, previews: Previews): boolean {
  return (
    previews.previewOf(row.reading, gatherIntentContext(), workspaceVersion(), row.text).key ===
    row.key
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
