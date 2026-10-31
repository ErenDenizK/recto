/**
 * The intent bar's reading row (PRD-39, spec §2.11, §2.15, §3): what a typed sentence will do,
 * drawn inside the palette's option. Per step a glyph and the sentence part; under it the
 * affected pages as small thumbnails (`FindThumb`, the one render cache; at most 8 then "+N"),
 * each ringed and marked with what will happen, its unaffected neighbours dimmed; a split shows
 * its parts; the footnote tells the undo story. The thumbnails are decoration (`aria-hidden`): the
 * option's name is the sentence and the footnote and reason are its description.
 *
 * They draw 120 ms after the row appears, so a burst of keys never asks the engine for a bitmap;
 * the row remounts with each new preview (`key`), which restarts that wait. Nothing animates per
 * key (A-10); marks never rely on colour alone (A-19).
 */
import { getActiveDocument, type VirtualDocument } from '@pdf-editor/document-model';
import { useEffect, useState } from 'react';

import type { ReadingRow } from '../../commands/palette-intent';
import type { PreviewStep } from '../../commands/intent/preview';
import type { Family } from '../../commands/intent/types';
import { m } from '../../i18n';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Icon, type IconName } from '../../ui/Icon';
import { useCoarsePointer } from '../../ui/Slider';
import { FindThumb } from '../sidebar/FindThumb';
import styles from './IntentRows.module.css';

/** Pages drawn per step; the rest are "+N". */
const MAX_PAGES = 8;
/** Neighbours are drawn only while the affected pages are few, so a strip stays one line. */
const NEIGHBOURS_UP_TO = 4;
/** The pause before the thumbnails ask for bitmaps (spec §2.19). */
const THUMB_DELAY_MS = 120;

const FAMILY_GLYPH: Readonly<Record<Family, IconName>> = {
  navigate: 'arrow-up-right',
  document: 'files',
  handoff: 'pen',
  output: 'download-simple',
  unavailable: 'info',
};

const MARK_GLYPH: Readonly<Record<NonNullable<PreviewStep['mark']>, IconName>> = {
  'rotate-right': 'arrow-clockwise',
  'rotate-left': 'arrow-counter-clockwise',
  'rotate-half': 'arrows-clockwise',
  delete: 'trash',
  duplicate: 'copy',
  move: 'arrows-out-cardinal',
  extract: 'export',
  number: 'hash',
  watermark: 'stamp',
  sign: 'signature',
  reverse: 'arrow-u-up-left',
};

interface StripItem {
  readonly page: number;
  readonly affected: boolean;
  /** A page or more between this and the one before it. */
  readonly gap: boolean;
}

/** The affected pages in order, each run with its one unaffected neighbour either side. */
export function stripItems(
  affected: readonly number[],
  pageCount: number,
  withNeighbours: boolean,
): StripItem[] {
  const pages = new Map<number, boolean>(affected.map((page) => [page, true]));
  if (withNeighbours) {
    for (const page of affected) {
      for (const near of [page - 1, page + 1]) {
        if (near >= 1 && near <= pageCount && !pages.has(near)) pages.set(near, false);
      }
    }
  }
  const sorted = [...pages].sort((a, b) => a[0] - b[0]);
  return sorted.map(([page, isAffected], i) => ({
    page,
    affected: isAffected,
    gap: i > 0 && page > (sorted[i - 1]?.[0] ?? 0) + 1,
  }));
}

/** True once `ms` have passed since the component mounted. */
function useAfter(ms: number): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true);
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  }, [ms]);
  return ready;
}

function Strip({
  step,
  doc,
  ready,
}: {
  readonly step: PreviewStep;
  readonly doc: VirtualDocument;
  readonly ready: boolean;
}) {
  const coarse = useCoarsePointer();
  const [width, height] = coarse ? [48, 64] : [32, 42];
  const pages = step.pages ?? [];
  const shown = pages.slice(0, MAX_PAGES);
  const more = pages.length - shown.length;
  const items = stripItems(shown, doc.pages.length, more === 0 && shown.length <= NEIGHBOURS_UP_TO);
  return (
    <span className={styles.strip} aria-hidden="true" data-strip="">
      {items.map((item) => (
        <span
          key={item.page}
          className={styles.thumb}
          data-page={item.page}
          data-affected={item.affected ? 'true' : 'false'}
          data-mark={item.affected ? step.mark : undefined}
          data-gap={item.gap ? '' : undefined}
        >
          <span className={styles.sheet} style={{ width, height }}>
            {ready ? (
              <FindThumb doc={doc} pageIndex={item.page - 1} width={width} height={height} />
            ) : null}
          </span>
          <span className={styles.number}>{item.page}</span>
          {item.affected && step.mark ? (
            <span className={styles.badge}>
              <Icon name={MARK_GLYPH[step.mark]} size={16} />
            </span>
          ) : null}
        </span>
      ))}
      {more > 0 ? (
        <span className={styles.more}>{m.intent_bar_more_pages({ count: more })}</span>
      ) : null}
    </span>
  );
}

function Parts({ parts }: { readonly parts: readonly string[] }) {
  return (
    <span className={styles.parts} aria-hidden="true">
      {parts.map((part, i) => (
        <span key={part} className={styles.partRun}>
          {i > 0 ? <Icon name="scissors" className={styles.cut} /> : null}
          <span className={styles.part}>{part}</span>
        </span>
      ))}
    </span>
  );
}

/** The undo story under a runnable reading (§2.11 `undo`). */
function footnoteOf(row: ReadingRow): string | undefined {
  const { preview } = row;
  if (!preview.runnable) return undefined;
  if (preview.steps.some((step) => step.family === 'output')) return m.intent_undo_copy();
  if (preview.undo === 'one') return m.intent_undo_one();
  if (preview.undo === 'separate') return m.intent_undo_separate();
  return undefined;
}

/**
 * One reading's content. `idBase` names its description (`-note`, `-reason`) for the option's
 * `aria-describedby`; the palette sets the option's name to `preview.sentence`.
 */
export function IntentReading({
  row,
  idBase,
}: {
  readonly row: ReadingRow;
  readonly idBase: string;
}) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const doc = getActiveDocument(workspace);
  const ready = useAfter(THUMB_DELAY_MS);
  const { preview } = row;
  const note = footnoteOf(row);
  const corrected = preview.corrected?.filter((c) => c.typed !== c.display) ?? [];
  // The reason repeats the label for an honest "can't do that" row: say it once.
  const reason =
    preview.reason !== undefined && preview.reason !== preview.sentence
      ? preview.reason
      : undefined;
  const details = preview.steps.flatMap((step) => (step.detail === undefined ? [] : [step.detail]));
  return (
    <>
      <span className={styles.body} data-reading="">
        {preview.steps.map((step, i) => (
          <span key={i} className={styles.step} data-family={step.family}>
            <span className={styles.line}>
              <Icon name={FAMILY_GLYPH[step.family]} className={styles.glyph} />
              <span className={styles.label} data-label="">
                {step.label}
              </span>
              {step.detail ? (
                <span className={styles.detail} aria-hidden="true">
                  {step.detail}
                </span>
              ) : null}
            </span>
            {doc && step.pages && step.pages.length > 0 ? (
              <Strip step={step} doc={doc} ready={ready} />
            ) : null}
            {step.parts && step.parts.length > 0 ? <Parts parts={step.parts} /> : null}
          </span>
        ))}
        {corrected.length > 0 ? (
          <span className={styles.corrected} data-corrected="">
            {corrected.map((c, i) => (
              <span key={c.typed}>
                {i > 0 ? ', ' : null}
                <span className="visually-hidden">
                  {m.intent_bar_corrected({ typed: c.typed, read: c.display })}
                </span>
                <span aria-hidden="true">
                  {c.typed} → {c.display}
                </span>
              </span>
            ))}
          </span>
        ) : null}
        <span id={`${idBase}-note`} className={note ? styles.note : 'visually-hidden'}>
          {note ?? details.join(', ')}
        </span>
      </span>
      {/* The reason takes the keycap's place (04-context §12.2); it describes the option. */}
      {reason ? (
        <span id={`${idBase}-reason`} className={styles.reason} data-reason="" aria-hidden="true">
          {reason}
        </span>
      ) : null}
    </>
  );
}
