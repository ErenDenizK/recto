/**
 * What a reading will do, before it runs (decision PRD-39; spec niyet §2.11, §2.15): one
 * `PreviewStep` per step with its words, its pages and its mark, the whole sentence in run order,
 * the undo story and whether it can run. `previewOf` is pure given the context and the workspace
 * version; `previewWithGuard` adds the change guard's and the registry's answers, which read the
 * stores. The bar (lane N3) only draws this.
 *
 * Words come from the action, never from the typed text: a corrected typo (`döndr`) shows the
 * action's own label, so the row always reads as properly spelled copy.
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import { quickSize } from '../../export/size-quick';
import { formatSize, getLocale, m } from '../../i18n';
import { changeRefusal, refusalReason } from '../../state/guard';
import { useWorkspaceStore } from '../../state/workspace-store';
import { foldForSearch } from '../fuzzy';
import { commandRegistry } from '../registry';
import {
  actOf,
  commandOf,
  coversAll,
  documentStepsOf,
  finishingStepOf,
  isDocumentStep,
  isNavigateStep,
  rangeChoiceOf,
  stepPages,
} from './plan';
import { splitParts } from './targets';
import {
  FAMILY,
  type Family,
  type IntentContext,
  type Pages,
  type Problem,
  type Reading,
  type Step,
} from './types';

export interface IntentPreview {
  /** Identifies what is on screen: the folded text, the steps, the workspace version. */
  readonly key: string;
  /** The option's accessible name: the whole reading in run order, "…, then …". */
  readonly sentence: string;
  readonly steps: readonly PreviewStep[];
  /** 'one' = one undo step; 'separate' = a handoff commits its own; 'none' = output/navigate only. */
  readonly undo: 'one' | 'separate' | 'none';
  readonly runnable: boolean;
  /** Why not, when not runnable (problem or guard refusal). */
  readonly reason?: string;
  /** For `unavailable`: the command row offered instead. */
  readonly nearest?: { readonly commandId: string; readonly title: string };
}

export interface PreviewStep {
  readonly family: Family;
  readonly label: string;
  readonly detail?: string;
  /** Pages to draw (1-based, now); the view draws at most 8 and "+N". */
  readonly pages?: readonly number[];
  readonly mark?:
    | 'rotate-right'
    | 'rotate-left'
    | 'rotate-half'
    | 'delete'
    | 'duplicate'
    | 'move'
    | 'extract'
    | 'number'
    | 'watermark'
    | 'sign'
    | 'reverse';
  /** Split: each part's pages, "1–10", "11–20", "21–24". */
  readonly parts?: readonly string[];
}

/** "2, 4, 6–8": page numbers as a row says them, runs with an en dash. */
export function pagesText(pages: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < pages.length; ) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === (pages[j] ?? 0) + 1) j++;
    parts.push(j > i ? `${pages[i]}–${pages[j]}` : `${pages[i]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

const KINDS = {
  email: m.redaction_pattern_email,
  phone: m.redaction_pattern_phone,
  iban: m.redaction_pattern_iban,
  tckn: m.redaction_pattern_tckn,
  card: m.redaction_pattern_card,
  date: m.redaction_pattern_date,
} as const;

const FORMAT_NAME = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  markdown: 'Markdown',
  text: 'TXT',
} as const;

const lowerFirst = (text: string): string =>
  text === '' ? text : text.charAt(0).toLocaleLowerCase(getLocale()) + text.slice(1);

/** The command offered under an honest "can't" row (§2.14), by id. */
function nearestTitle(commandId: string): string | undefined {
  return commandId === 'document.exportMarkdown' ? m.cmd_convert_markdown() : undefined;
}

function problemText(kind: Problem, ctx: IntentContext): string {
  switch (kind) {
    case 'no-document':
      return m.palette_intent_no_document();
    case 'out-of-range':
      return m.palette_intent_out_of_range({ count: ctx.pageCount });
    case 'reversed-range':
      return m.palette_intent_reversed();
    case 'no-pages':
      return m.palette_intent_no_pages();
    case 'all-pages':
      return m.palette_intent_all_pages();
    case 'ambiguous-count':
      return m.palette_intent_ambiguous();
    case 'needs-pages':
      return m.intent_reason_needs_pages();
    case 'not-a-run':
      return m.intent_reason_not_a_run();
    case 'shifted':
      return m.intent_reason_shifted();
    case 'two-finishing':
      return m.intent_reason_two_finishing();
    case 'after-split':
      return m.intent_reason_after_split();
    case 'single-part':
      return m.intent_reason_single_part();
    case 'phone':
      return m.intent_reason_phone();
  }
}

const countDetail = (pages: Pages): string => m.palette_intent_count({ count: pages.pages.length });

/** The preview of one step. */
export function previewStep(step: Step, ctx: IntentContext): PreviewStep {
  const family: Family = FAMILY[step.action];
  const pages = stepPages(step);
  const input = pages ? { count: pages.pages.length, pages: pagesText(pages.pages) } : undefined;
  switch (step.action) {
    case 'goto':
      return { family, label: m.palette_intent_go_page({ page: step.page }) };
    case 'heading': {
      const first = step.matches[0];
      return {
        family,
        label: m.palette_intent_go_heading({ title: first?.title ?? step.text }),
        ...(first ? { detail: m.palette_intent_page_n({ page: first.page }) } : {}),
      };
    }
    case 'recent':
      return {
        family,
        label: m.palette_intent_open_recent({ name: step.matches[0]?.name ?? step.text }),
      };
    case 'find':
      return { family, label: m.intent_find({ text: step.text }) };
    case 'rotate': {
      const label =
        step.turns === 1
          ? m.palette_intent_rotate_right(input as NonNullable<typeof input>)
          : step.turns === -1
            ? m.palette_intent_rotate_left(input as NonNullable<typeof input>)
            : m.palette_intent_rotate_half(input as NonNullable<typeof input>);
      return {
        family,
        label,
        detail: countDetail(step.pages),
        pages: step.pages.pages,
        mark: step.turns === 1 ? 'rotate-right' : step.turns === -1 ? 'rotate-left' : 'rotate-half',
      };
    }
    case 'delete':
      return {
        family,
        label: m.palette_intent_delete(input as NonNullable<typeof input>),
        detail: countDetail(step.pages),
        pages: step.pages.pages,
        mark: 'delete',
      };
    case 'duplicate':
      return {
        family,
        label: m.palette_intent_duplicate(input as NonNullable<typeof input>),
        detail: countDetail(step.pages),
        pages: step.pages.pages,
        mark: 'duplicate',
      };
    case 'extract':
      return {
        family,
        label: m.palette_intent_extract(input as NonNullable<typeof input>),
        detail: m.intent_detail_opens({ name: m.cmd_extract_pages() }),
        pages: step.pages.pages,
        mark: 'extract',
      };
    case 'move': {
      const base = input as NonNullable<typeof input>;
      const { to } = step;
      const label =
        to === 'start'
          ? m.intent_move_start(base)
          : to === 'end'
            ? m.intent_move_end(base)
            : 'before' in to
              ? m.intent_move_before({ ...base, target: to.before })
              : m.intent_move_after({ ...base, target: to.after });
      return {
        family,
        label,
        detail: countDetail(step.pages),
        pages: step.pages.pages,
        mark: 'move',
      };
    }
    case 'reverse':
      return {
        family,
        label: coversAll(step.pages, ctx.pageCount)
          ? m.intent_reverse_all()
          : m.intent_reverse({ pages: pagesText(step.pages.pages) }),
        detail: countDetail(step.pages),
        pages: step.pages.pages,
        mark: 'reverse',
      };
    case 'split': {
      const parts = splitParts(ctx.pageCount, step.how).map(([a, b]) =>
        a === b ? `${a}` : `${a}–${b}`,
      );
      if (step.how === 'choose') {
        return {
          family: 'handoff',
          label: m.intent_split_choose(),
          detail: m.intent_detail_opens({ name: m.cmd_split_document() }),
        };
      }
      const label =
        'every' in step.how
          ? m.intent_split_every({ n: step.how.every })
          : 'at' in step.how
            ? m.intent_split_at({ pages: pagesText(step.how.at) })
            : m.intent_split_parts({ n: step.how.parts });
      return {
        family,
        label,
        parts,
        ...(parts.length > 0 ? { detail: m.intent_detail_parts({ count: parts.length }) } : {}),
      };
    }
    case 'pageNumbers':
      return {
        family,
        label: coversAll(step.pages, ctx.pageCount)
          ? m.intent_page_numbers_all()
          : m.intent_page_numbers({ pages: pagesText(step.pages.pages) }),
        detail: countDetail(step.pages),
        pages: step.pages.pages,
        mark: 'number',
      };
    case 'watermark':
      return step.text === null
        ? {
            family: 'handoff',
            label: m.intent_watermark_ask(),
            detail: m.intent_detail_opens({ name: m.cmd_watermark() }),
            pages: step.pages.pages,
            mark: 'watermark',
          }
        : {
            family,
            label: m.intent_watermark({ text: step.text }),
            detail: countDetail(step.pages),
            pages: step.pages.pages,
            mark: 'watermark',
          };
    case 'compress':
      return {
        family,
        label:
          step.targetBytes === null
            ? m.intent_compress()
            : m.intent_compress_target({ size: formatSize(step.targetBytes) }),
        detail: m.intent_detail_opens({ name: m.cmd_export() }),
      };
    case 'exportImages': {
      const format = FORMAT_NAME[step.format];
      return {
        family,
        label: coversAll(step.pages, ctx.pageCount)
          ? m.intent_export_images_all({ format })
          : m.intent_export_images({ pages: pagesText(step.pages.pages), format }),
        detail: `${countDetail(step.pages)} → ${format}`,
        pages: step.pages.pages,
      };
    }
    case 'exportText':
      return {
        family,
        label: m.intent_export_text({ format: FORMAT_NAME[step.format] }),
        detail: m.intent_detail_opens({ name: m.cmd_export() }),
      };
    case 'signPlace':
      return {
        family,
        label:
          ctx.savedSignatures > 0
            ? m.intent_sign_place({ page: step.page })
            : m.intent_sign_draw({ page: step.page }),
        detail: m.intent_detail_spot(),
        pages: [step.page],
        mark: 'sign',
      };
    case 'redactFind':
      return {
        family,
        label: m.intent_redact_find({
          kinds: step.patterns.map((id) => KINDS[id]().toLocaleLowerCase(getLocale())).join(', '),
        }),
      };
    case 'ocr':
      return {
        family,
        label: m.ocr_cmd(),
        detail: countDetail(step.pages),
        pages: step.pages.pages,
      };
    case 'saveCopy':
      return { family, label: m.cmd_export() };
    case 'print':
      return { family, label: m.cmd_print() };
    case 'combine':
      return { family, label: m.cmd_combine_open() };
    case 'certify':
      return { family, label: m.cmd_sign() };
    case 'password':
      return { family, label: m.cmd_set_password() };
    case 'fill':
      return { family, label: m.dock_fill_sign() };
    case 'officeToPdf':
      return { family, label: m.cmd_open_files() };
    case 'unavailable':
      return {
        family,
        label:
          step.capability === 'pdf-to-word'
            ? m.intent_unavailable_word()
            : step.capability === 'pdf-to-excel'
              ? m.intent_unavailable_excel()
              : step.capability === 'pdf-to-powerpoint'
                ? m.intent_unavailable_powerpoint()
                : m.intent_unavailable_translate(),
      };
  }
}

/** The whole reading as one sentence in run order: "Rotate pages 3–5 right, then …". */
export function sentenceOf(labels: readonly string[]): string {
  return labels.reduce((first, next) => m.intent_then({ first, next: lowerFirst(next) }));
}

/** The words of the document steps as the history lists them. */
export function historyLabel(reading: Reading, ctx: IntentContext): string {
  return m.history_intent({
    steps: sentenceOf(documentStepsOf(reading).map((step) => previewStep(step, ctx).label)),
  });
}

function undoOf(reading: Reading): IntentPreview['undo'] {
  const finishing = finishingStepOf(reading);
  const documents = documentStepsOf(reading).length > 0;
  if (finishing !== undefined && FAMILY[finishing.action] === 'handoff') return 'separate';
  if (finishing?.action === 'split') return 'separate';
  if (documents) return 'one';
  return 'none';
}

/**
 * The preview of a reading. `text` is what was typed: the key folds it, so a preview drawn from
 * other text never matches (§2.13). Pure given `ctx` and `version`.
 */
export function previewOf(
  reading: Reading,
  ctx: IntentContext,
  version: number,
  text = '',
): IntentPreview {
  const steps = reading.steps.map((step) => previewStep(step, ctx));
  const key = `${version}|${foldForSearch(text).trim().replace(/\s+/g, ' ')}|${JSON.stringify(reading.steps)}`;
  const unavailable = reading.steps.find((step) => step.action === 'unavailable');
  let reason: string | undefined;
  let nearest: IntentPreview['nearest'];
  if (reading.problem !== null) reason = problemText(reading.problem.kind, ctx);
  if (unavailable?.action === 'unavailable') {
    reason ??= steps[0]?.label;
    const title = unavailable.nearest === null ? undefined : nearestTitle(unavailable.nearest);
    if (unavailable.nearest !== null && title !== undefined) {
      nearest = { commandId: unavailable.nearest, title };
    }
  }
  // Furniture over a list with gaps cannot be one range: the parser says so; this keeps a hand-made
  // reading from reaching the runner.
  for (const step of reading.steps) {
    const pages = stepPages(step);
    if (
      reason === undefined &&
      pages !== undefined &&
      (step.action === 'pageNumbers' || (step.action === 'watermark' && step.text !== null)) &&
      rangeChoiceOf(pages, ctx.pageCount) === null
    ) {
      reason = m.intent_reason_not_a_run();
    }
  }
  return {
    key,
    sentence: sentenceOf(steps.map((s) => s.label)),
    steps,
    undo: undoOf(reading),
    runnable: reason === undefined && reading.steps.length > 0,
    ...(reason === undefined ? {} : { reason }),
    ...(nearest === undefined ? {} : { nearest }),
  };
}

/**
 * Why a reading cannot run in the stores' present state, or undefined (§2.12 step 2): the change
 * guard for every document step, the registry for every finishing one. Redacting is not refused
 * for "not in Read mode": the runner switches to it first. Extract's command waits for a
 * selection the runner makes itself, so only the document is asked for.
 */
export function guardReason(reading: Reading): string | undefined {
  const ws = useWorkspaceStore.getState().workspace;
  const doc = getActiveDocument(ws);
  for (const step of reading.steps) {
    if (isNavigateStep(step)) continue;
    if (isDocumentStep(step)) {
      const refusal = changeRefusal(doc?.id, actOf(step));
      if (refusal !== undefined) return refusalReason(refusal);
      continue;
    }
    if (doc === undefined && step.action !== 'combine') return m.palette_intent_no_document();
    if (step.action === 'watermark') {
      const refusal = changeRefusal(doc?.id, 'document');
      if (refusal !== undefined) return refusalReason(refusal);
      continue;
    }
    if (step.action === 'redactFind' || step.action === 'extract' || step.action === 'fill')
      continue;
    const id = commandOf(step);
    const command = id === null ? undefined : commandRegistry.get(id);
    if (command !== undefined && !commandRegistry.isEnabled(command)) {
      return commandRegistry.disabledReason(command) ?? m.guard_no_document();
    }
  }
  return undefined;
}

/** `previewOf` plus the guard's answer and the document's size where a row quotes it. */
export function previewWithGuard(
  reading: Reading,
  ctx: IntentContext,
  version: number,
  text = '',
): IntentPreview {
  const base = previewOf(reading, ctx, version, text);
  const ws = useWorkspaceStore.getState().workspace;
  const doc = getActiveDocument(ws);
  const size = doc ? quickSize(ws, doc) : null;
  const steps = base.steps.map((step, i) =>
    reading.steps[i]?.action === 'compress' && size !== null
      ? { ...step, detail: m.intent_detail_now({ size: formatSize(size) }) }
      : step,
  );
  if (!base.runnable) return { ...base, steps };
  const reason = guardReason(reading);
  return reason === undefined ? { ...base, steps } : { ...base, steps, runnable: false, reason };
}
