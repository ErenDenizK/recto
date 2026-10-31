/**
 * One line per parse: what the bar would show, in a form the owner can read without code (spec
 * §4.1). `a ; b` is a chain in run order, `? a | b` two readings, `! kind a` a reading with a
 * problem, `partial action "word"`, `unavailable what ~command`, `none`.
 */
import { splitParts } from '../targets';
import type { Pages, ParseResult, Reading, Step } from '../types';

/** Pages as a row writes them: a run is `3-5`, a list `2,4,6…` (more than six items: three, then …). */
export function showPages(p: readonly number[]): string {
  if (p.length === 0) return '';
  const first = p[0] as number;
  const last = p.at(-1) as number;
  if (p.length > 1 && last - first === p.length - 1) return `${first}-${last}`;
  return p.length > 6 ? `${p.slice(0, 3).join(',')}…` : p.join(',');
}

const ALL_WORD = new Set<Step['action']>([
  'reverse',
  'pageNumbers',
  'watermark',
  'exportImages',
  'ocr',
]);
function pagesOf(step: Step, pages: Pages): string {
  if (pages.named === 'all' && ALL_WORD.has(step.action)) return 'all';
  if (pages.named === 'even' || pages.named === 'odd') {
    if (step.action === 'pageNumbers' || step.action === 'watermark') return pages.named;
  }
  return showPages(pages.pages);
}

function bytes(n: number): string {
  for (const [unit, size] of [
    ['GB', 1024 ** 3],
    ['MB', 1024 ** 2],
    ['KB', 1024],
  ] as const) {
    if (n >= size) return `${Number((n / size).toFixed(2))}${unit}`;
  }
  return `${n}B`;
}

function showStep(step: Step, pageCount: number): string {
  const inherited = 'pages' in step && step.pages.inherited ? ' (inherited)' : '';
  switch (step.action) {
    case 'goto':
      return `goto ${step.page}`;
    case 'heading':
      return `heading "${step.text}" ${step.matches[0]?.title ?? '-'}`;
    case 'recent':
      return `recent "${step.text}" ${step.matches[0]?.name ?? '-'}`;
    case 'find':
      return `find "${step.text}"`;
    case 'rotate':
      return `rotate ${showPages(step.pages.pages)} ${step.turns === 2 ? 2 : step.turns > 0 ? '+1' : '-1'}${inherited}`;
    case 'delete':
    case 'duplicate':
    case 'extract':
      return `${step.action} ${showPages(step.pages.pages)}${inherited}`;
    case 'reverse':
      return `reverse ${pagesOf(step, step.pages)}`;
    case 'ocr':
      return `ocr ${pagesOf(step, step.pages)}`;
    case 'pageNumbers':
      return `numbers ${pagesOf(step, step.pages)}`;
    case 'move': {
      const to =
        typeof step.to === 'string'
          ? step.to
          : 'before' in step.to
            ? `before ${step.to.before}`
            : `after ${step.to.after}`;
      return `move ${showPages(step.pages.pages)} ${to}${inherited}`;
    }
    case 'split': {
      if (step.how === 'choose') return 'split choose';
      const parts = splitParts(pageCount, step.how).map(([a, b]) =>
        a === b ? `${a}` : `${a}-${b}`,
      );
      const how =
        'every' in step.how
          ? `every ${step.how.every}`
          : 'at' in step.how
            ? `at ${step.how.at.join(',')}`
            : `parts ${step.how.parts}`;
      return `split ${how}${parts.length > 0 ? ` [${parts.length > 6 ? `${parts.slice(0, 3).join(' ')}…` : parts.join(' ')}]` : ''}`;
    }
    case 'watermark':
      return `watermark ${step.text === null ? '?' : `"${step.text}"`} ${pagesOf(step, step.pages)}`;
    case 'compress':
      return step.targetBytes === null ? 'compress' : `compress <${bytes(step.targetBytes)}`;
    case 'exportImages':
      return `export ${step.format} ${pagesOf(step, step.pages)}`;
    case 'exportText':
      return `text ${step.format}`;
    case 'signPlace':
      return `sign ${step.page}`;
    case 'redactFind':
      return `redact ${step.patterns.join(' ')}`;
    case 'officeToPdf':
      return 'office-to-pdf';
    case 'unavailable':
      return `unavailable ${step.capability}${step.nearest ? ` ~${step.nearest}` : ''}`;
    default:
      return step.action === 'saveCopy' ? 'save-copy' : step.action;
  }
}

function showReading(r: Reading, pageCount: number): string {
  const steps = r.steps.map((s) => showStep(s, pageCount).replace(/\s+/g, ' ').trim()).join(' ; ');
  const fix = r.corrected?.map((c) => ` (${c.typed}→${c.read})`).join('') ?? '';
  const page = r.problem?.page === undefined ? '' : ` ${r.problem.page}`;
  return `${r.problem ? `! ${r.problem.kind}${page} ` : ''}${steps}${fix}`;
}

export function show(result: ParseResult, pageCount: number): string {
  switch (result.kind) {
    case 'none':
      return 'none';
    case 'partial':
      return `partial ${result.action} ${result.unknown.map((w) => `"${w}"`).join(' ')}`;
    case 'readings': {
      const lines = result.readings.map((r) => showReading(r, pageCount));
      return lines.length === 2 ? `? ${lines.join(' | ')}` : (lines[0] as string);
    }
  }
}
