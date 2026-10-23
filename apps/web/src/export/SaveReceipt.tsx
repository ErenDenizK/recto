/**
 * The save receipt in Save a copy (DSN-67, behind `?receipt=1`, `receipt-flag.ts`): before the
 * copy is written it shows what is in it. Changed pages as small thumbnails, each with what
 * changed on it (text edited, marks, a signature, a page added, a page rotated) and a line for
 * pages taken out; and the file's size as two bars, the original and this copy, which spring to
 * their new length when the Size choice changes.
 *
 * Honest numbers only: the copy's bar is an approximation (≈) until the copy is assembled and
 * read; a preset's size that is not known yet shows a skeleton bar, never an invented number.
 */
import type { VirtualDocument, Workspace } from '@pdf-editor/document-model';
import { useLayoutEffect, useRef } from 'react';

import { RENDER_PRIORITY } from '../engine/engine-service';
import { formatSize, m } from '../i18n';
import { animateStyle, reducedMotion } from '../motion';
import { PageCanvas } from '../pages/PageCanvas';
import { displaySize, fitInBox } from '../pages/page-geometry';
import { contentFrame, ResizedContent } from '../stage/ResizedContent';
import { Icon, type IconName } from '../ui/Icon';
import { SheetGroup, SheetRow } from '../ui/sheet';
import { type ChangedPage, changedPages, type ChangeKind } from './changed-pages';
import { FLIGHT_SOURCE_ATTRIBUTE } from './save-flight';
import styles from './SaveReceipt.module.css';

/** The thumbnail box (the title menu's, 48 × 62). */
const THUMB = { width: 48, height: 62 } as const;
/** Changed pages shown; the rest are counted. */
const MAX_SHOWN = 6;

const KIND_ICON: Readonly<Record<ChangeKind, IconName>> = {
  text: 'text-aa',
  marks: 'highlighter',
  signature: 'signature',
  added: 'file-plus',
  rotated: 'arrow-clockwise',
};

const kindLabel = (kind: ChangeKind): string =>
  ({
    text: m.save_receipt_kind_text(),
    marks: m.save_receipt_kind_marks(),
    signature: m.save_receipt_kind_signature(),
    added: m.save_receipt_kind_added(),
    rotated: m.save_receipt_kind_rotated(),
  })[kind];

function Thumb({
  ws,
  changed,
  first,
}: {
  readonly ws: Workspace;
  readonly changed: ChangedPage;
  readonly first: boolean;
}) {
  const { page } = changed;
  const size = displaySize(ws, page);
  const box = fitInBox(size, THUMB.width, THUMB.height);
  const frame = contentFrame(ws, page);
  const kinds = changed.kinds.map(kindLabel).join(', ');
  return (
    <li
      className={styles.page}
      aria-label={m.save_receipt_page({ page: changed.position, kinds })}
      data-testid="save-receipt-page"
      data-kinds={changed.kinds.join(' ')}
    >
      <div
        className={styles.thumb}
        style={{ width: box.width, height: box.height }}
        {...(first ? { [FLIGHT_SOURCE_ATTRIBUTE]: '' } : {})}
      >
        <ResizedContent frame={frame}>
          <PageCanvas
            sourceId={page.ref.kind === 'source' ? page.ref.source : undefined}
            blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
            index={page.ref.kind === 'source' ? page.ref.index : 0}
            rotation={page.rotation}
            widthPt={frame?.widthPt ?? size.width}
            heightPt={frame?.heightPt ?? size.height}
            cssWidth={box.width * (frame?.width ?? 1)}
            priority={RENDER_PRIORITY.visible}
          />
        </ResizedContent>
      </div>
      <span className={styles.meta} aria-hidden="true" title={kinds}>
        <span className={styles.number}>{changed.position}</span>
        <span className={styles.kinds}>
          {changed.kinds.map((kind) => (
            <Icon key={kind} name={KIND_ICON[kind]} />
          ))}
        </span>
      </span>
    </li>
  );
}

/** One bar: `share` of the track, on a spring (an instant jump under reduced motion). */
function Bar({
  label,
  share,
  value,
  testId,
}: {
  readonly label: string;
  /** 0..1 of the track, or null for a size not known yet (a skeleton). */
  readonly share: number | null;
  readonly value: string | null;
  readonly testId: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const shown = useRef(0);
  useLayoutEffect(() => {
    const el = fill.current;
    const width = track.current?.clientWidth ?? 0;
    if (!el || share === null || width === 0) return;
    const to = Math.max(2, Math.round(width * share));
    const from = shown.current === 0 ? 0 : shown.current;
    shown.current = to;
    if (reducedMotion() || from === to) {
      el.style.width = `${to}px`;
      return;
    }
    animateStyle(el, 'width', from, to, { spring: 'smooth', keep: true });
  }, [share]);
  return (
    <div className={styles.barRow} data-testid={testId}>
      <span className={styles.barLabel}>{label}</span>
      <div ref={track} className={styles.track}>
        <div ref={fill} className={styles.fill} data-state={share === null ? 'unknown' : 'known'} />
      </div>
      <span className={styles.barValue} data-testid={`${testId}-value`}>
        {value ?? '…'}
      </span>
    </div>
  );
}

export function SaveReceipt({
  ws,
  doc,
  after,
  approximate,
}: {
  readonly ws: Workspace;
  readonly doc: VirtualDocument;
  /** The copy's size in bytes as the Size choice stands, or null while it is not known. */
  readonly after: number | null;
  /** The copy's size is an estimate, not the assembled copy's. */
  readonly approximate: boolean;
}) {
  const { pages, deleted } = changedPages(ws, doc);
  const shown = pages.slice(0, MAX_SHOWN);
  const more = pages.length - shown.length;
  const sources = new Set<string>();
  let before = 0;
  for (const page of doc.pages) {
    if (page.ref.kind !== 'source' || sources.has(page.ref.source)) continue;
    sources.add(page.ref.source);
    before += ws.sources[page.ref.source]?.byteLength ?? 0;
  }
  const largest = Math.max(before, after ?? 0);
  const afterText =
    after === null
      ? null
      : approximate
        ? m.save_copy_estimate({ size: formatSize(after) })
        : formatSize(after);
  return (
    <SheetGroup label={m.save_receipt_title()} data-testid="save-receipt">
      <SheetRow full>
        <div className={styles.receipt}>
          {pages.length === 0 && deleted === 0 ? (
            <p className={styles.none}>{m.save_receipt_unchanged()}</p>
          ) : (
            <ul className={styles.pages}>
              {shown.map((changed, i) => (
                <Thumb key={changed.page.id} ws={ws} changed={changed} first={i === 0} />
              ))}
              {more > 0 ? (
                <li className={styles.more} aria-label={`+${more}`}>
                  +{more}
                </li>
              ) : null}
              {deleted > 0 ? (
                <li className={styles.removed} data-testid="save-receipt-deleted">
                  <Icon name="trash" />
                  {m.save_receipt_deleted({ count: deleted })}
                </li>
              ) : null}
            </ul>
          )}
          {before > 0 ? (
            <div
              className={styles.bars}
              role="img"
              aria-label={
                afterText === null
                  ? m.save_receipt_original() + ' ' + formatSize(before)
                  : m.save_receipt_sizes({ before: formatSize(before), after: afterText })
              }
            >
              <Bar
                label={m.save_receipt_original()}
                share={before / largest}
                value={formatSize(before)}
                testId="save-receipt-before"
              />
              <Bar
                label={m.save_receipt_copy()}
                share={after === null || largest === 0 ? null : after / largest}
                value={afterText}
                testId="save-receipt-after"
              />
            </div>
          ) : null}
        </div>
      </SheetRow>
    </SheetGroup>
  );
}
