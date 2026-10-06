/**
 * What ↶ ↷, the History scrubber and the announcements say about a history step (01-frame F3
 * §5, 08-feedback FB7 §5; spec redesign X10): the step's label, today's history strings, put
 * in a sentence with the page and document its `HistoryEntry.meta` names.
 *
 * - "Undo highlight on page 3": a label that does not name its page gets "on page n"; one
 *   that does ("Highlight on page 3", "3. sayfaya vurgu eklendi") is left as it is.
 * - "Undo highlight in agreement.pdf": a step in another open document names it instead
 *   (the step is not undone where the user is looking, so the page would mislead).
 * - Opening and closing name their file in the label already, so they get neither.
 */
import {
  canRedo,
  canUndo,
  type DocumentId,
  type History,
  type HistoryEntryMeta,
  type Workspace,
} from '@pdf-editor/document-model';

import { getLocale, m } from '../i18n';

/** A step as the labels need it: a history entry or a `historyEntries` item. */
export interface StepLike {
  readonly label: string;
  readonly meta?: HistoryEntryMeta | undefined;
}

export interface StepContext {
  /** Where document titles are looked up first: the workspace shown now. */
  readonly workspace: Workspace;
  /** Further workspaces to look a title up in (a closed document is only in older ones). */
  readonly fallbacks?: readonly Workspace[];
}

/**
 * The label inside a sentence: its first letter in lower case, unless the first word is an
 * acronym or a name in capitals ("OCR applied" stays). Uses the active language's case rules
 * ("İ" lowers to "i" in Turkish).
 */
export function inSentence(label: string): string {
  const first = label.codePointAt(0);
  if (first === undefined) return label;
  const head = String.fromCodePoint(first);
  const second = label.codePointAt(head.length);
  if (second !== undefined && /\p{Lu}/u.test(String.fromCodePoint(second))) return label;
  return head.toLocaleLowerCase(getLocale()) + label.slice(head.length);
}

/**
 * The words a label uses to name page `page`: the page part of `history_annot_create`, which
 * the labels that name a page are made from ("{kind} on page {page}" gives "on page 3";
 * "{page}. sayfaya {kind} eklendi" gives "3. sayfaya"). A bare number is not enough: "Rotate 1
 * page" says nothing about page 1.
 */
function pageWords(page: number): string {
  const marker = '\u0001';
  const text = m.history_annot_create({ kind: marker, page });
  const part = text.split(marker).find((piece) => piece.includes(String(page)));
  return (part ?? String(page)).trim().toLocaleLowerCase(getLocale());
}

/** Whether `label` already says page `page` ("Highlight on page 3", "3. sayfaya …"). */
export function labelNamesPage(label: string, page: number): boolean {
  const words = pageWords(page).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Not inside a longer number: "on page 13" does not name page 1, nor "13. sayfaya" page 3.
  return new RegExp(`(^|\\D)${words}(\\D|$)`).test(label.toLocaleLowerCase(getLocale()));
}

function titleOf(id: DocumentId, context: StepContext): string | undefined {
  for (const ws of [context.workspace, ...(context.fallbacks ?? [])]) {
    const title = ws.documents[id]?.title;
    if (title !== undefined) return title;
  }
  return undefined;
}

/** The step in a sentence, with its page or its document: "highlight on page 3". */
export function stepPhrase(step: StepLike, context: StepContext): string {
  const label = inSentence(step.label);
  const meta = step.meta;
  if (meta === undefined || meta.kind === 'open' || meta.kind === 'close') return label;
  const active = context.workspace.activeDocument;
  if (meta.documentId !== undefined && active !== undefined && meta.documentId !== active) {
    const document = titleOf(meta.documentId, context);
    if (document !== undefined) return m.history_step_in_document({ label, document });
  }
  if (meta.page !== undefined && !labelNamesPage(step.label, meta.page)) {
    return m.history_step_on_page({ label, page: meta.page });
  }
  return label;
}

/** Whether the step was made in a document other than the active one (the toast case). */
export function inOtherDocument(step: StepLike, workspace: Workspace): boolean {
  const id = step.meta?.documentId;
  return (
    id !== undefined &&
    workspace.activeDocument !== undefined &&
    id !== workspace.activeDocument &&
    workspace.documents[id] !== undefined
  );
}

/** ↶'s tooltip: "Undo highlight on page 3", or "Nothing to undo". */
export function undoTooltip(history: History): string {
  if (!canUndo(history)) return m.undo_nothing();
  const before = history.past[history.past.length - 1];
  const context: StepContext = {
    workspace: history.present.workspace,
    ...(before === undefined ? {} : { fallbacks: [before.workspace] }),
  };
  return m.undo_step({ step: stepPhrase(history.present, context) });
}

/** ↷'s tooltip: "Redo highlight on page 3", or "Nothing to redo". */
export function redoTooltip(history: History): string {
  const next = history.future[0];
  if (!canRedo(history) || next === undefined) return m.redo_nothing();
  const context = { workspace: history.present.workspace, fallbacks: [next.workspace] };
  return m.redo_step({ step: stepPhrase(next, context) });
}

/** A step's time in the scrubber: "14:05", 24-hour by locale (FB7 §5). */
export function stepTime(at: number): string {
  return new Intl.DateTimeFormat(getLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
}

/**
 * An opening's label as the scrubber says it, in the past tense (FB7 §5: the first row reads
 * "Opened"): "Open report.pdf" becomes "Opened report.pdf". The name is read back from the
 * label through `history_open`'s own words, so a drop's "Open 2 files" works too; a label in
 * any other shape is kept. Turkish says both as "report.pdf açıldı".
 */
export function openedLabel(label: string): string {
  const marker = '\u0001';
  const [head = '', tail = ''] = m.history_open({ name: marker }).split(marker);
  if (label.length <= head.length + tail.length) return label;
  if (!label.startsWith(head) || !label.endsWith(tail)) return label;
  return m.history_opened({ name: label.slice(head.length, label.length - tail.length) });
}

/** One row of the History scrubber (FB7 §2, §5). */
export interface ScrubberStep {
  /** Index into `historyEntries(history)`, what `jumpTo` takes. */
  readonly index: number;
  readonly state: 'past' | 'present' | 'future';
  readonly label: string;
  readonly time: string;
  /** The page, when the label does not say it already. */
  readonly page?: number;
  /** The document, only with two or more documents open (flows.md §12). */
  readonly document?: string;
  /** The accessible name: "Highlight, page 3, 14:05". */
  readonly name: string;
  /** The step in a sentence, for the slider's value text and the announcement. */
  readonly phrase: string;
}

/**
 * The scrubber's steps, newest first. Steps whose workspace has no document (the empty
 * start, everything closed) are left out: jumping there would close the view the scrubber
 * belongs to (FB7's first row is the opening, "Opened").
 */
export function scrubberSteps(history: History): ScrubberStep[] {
  const { workspace } = history.present;
  const several = workspace.documentOrder.length > 1;
  const entries = [...history.past, history.present, ...history.future];
  const presentIndex = history.past.length;
  const steps: ScrubberStep[] = [];
  entries.forEach((entry, index) => {
    if (entry.workspace.documentOrder.length === 0) return;
    const meta = entry.meta;
    const label = meta?.kind === 'open' ? openedLabel(entry.label) : entry.label;
    const page =
      meta?.page !== undefined && !labelNamesPage(entry.label, meta.page) ? meta.page : undefined;
    const id = meta?.documentId;
    const document =
      several && id !== undefined
        ? titleOf(id, { workspace, fallbacks: [entry.workspace] })
        : undefined;
    const time = stepTime(entry.at);
    steps.push({
      index,
      state: index < presentIndex ? 'past' : index === presentIndex ? 'present' : 'future',
      label,
      time,
      ...(page === undefined ? {} : { page }),
      ...(document === undefined ? {} : { document }),
      name:
        page === undefined
          ? m.history_option({ label, time })
          : m.history_option_page({ label, page, time }),
      phrase: stepPhrase({ ...entry, label }, { workspace, fallbacks: [entry.workspace] }),
    });
  });
  return steps.reverse();
}
