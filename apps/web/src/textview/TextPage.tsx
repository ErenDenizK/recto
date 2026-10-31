/**
 * One page of the Text view (PRD-36 §2, §3, §6, §7): the separator with "Show page", then what
 * the loader holds for it: the blocks (h2 to h5, paragraphs, nested lists by depth, image
 * crops), or a skeleton while it loads, a card when it failed, or a card when it is a scan.
 * Find's mark is wrapped around the hit's words, or lightly around the whole block when the
 * words were not found (`FindMark.exact`). Every block, item and page carries `data-anchor` and
 * its place (`data-page`, `data-y`, `data-h`), which the view reads to keep the reader's place.
 * Nothing here carries the text-layer attribute: the view is read-only (BM-15).
 */
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { TextViewBlock, TextViewListItem, TextViewPage } from '@pdf-editor/engine';

import { formatSize, m } from '../i18n';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import type { FindMark, ImageCrops, OcrOfferInfo, TextViewLoader, TextViewPlace } from './contract';
import styles from './TextView.module.css';

/** What the scanned-page cards need of the view's OCR run (EDN-27). */
export interface ScanControl {
  readonly info: OcrOfferInfo | null;
  /** The pages being recognized and how far along, or null. */
  readonly run: {
    readonly pages: ReadonlySet<number>;
    readonly done: number;
    readonly total: number;
  } | null;
  readonly failed: boolean;
  /** Reads the pack's size for the cards (once). */
  readonly loadInfo: () => void;
  readonly start: (pages: readonly number[]) => void;
}

export interface TextPageProps {
  readonly page: number;
  readonly loader: TextViewLoader;
  readonly crops: ImageCrops;
  readonly mark: FindMark | null;
  readonly scan: ScanControl;
  /** Every page read so far is a scan: one card at the top asks for all of them. */
  readonly allScans: boolean;
  readonly onShowPage: (place: TextViewPlace) => void;
}

/** Pages recognized together by one card: its aligned group of 4, the loader's chunk (EDN-27). */
export function scanGroup(loader: TextViewLoader, page: number): number[] {
  const first = page - (page % 4);
  const group: number[] = [];
  for (let index = first; index < Math.min(first + 4, loader.pageCount); index++) {
    const state = loader.peek(index);
    if (typeof state === 'object' && state.needsOcr) group.push(index);
  }
  return group.length > 0 ? group : [page];
}

/** The text of a block with the mark's range wrapped, or the text as it is. */
function marked(text: string, mark: FindMark | null): ReactNode {
  if (!mark) return text;
  const start = mark.exact ? Math.min(Math.max(0, mark.start), text.length) : 0;
  const end = mark.exact ? Math.min(text.length, start + Math.max(0, mark.length)) : text.length;
  if (end <= start) return text;
  return (
    <>
      {text.slice(0, start)}
      <mark data-testid="text-view-mark" data-soft={mark.exact ? undefined : ''}>
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

function placeAttrs(page: number, box: { y: number; height: number }, id: string) {
  return {
    'data-anchor': '',
    'data-page': page,
    'data-y': box.y,
    'data-h': box.height,
    'data-block-id': id,
  } as const;
}

/** A list's items as nested lists by depth (a jump of more than one level is one level). */
function ListItems({
  block,
  mark,
}: {
  readonly block: Extract<TextViewBlock, { kind: 'list' }>;
  readonly mark: FindMark | null;
}) {
  const depths: number[] = [];
  for (const [index, item] of block.items.entries()) {
    const previous = depths[index - 1];
    depths.push(previous === undefined ? 0 : Math.min(Math.max(0, item.depth), previous + 1));
  }
  const level = (start: number, depth: number): [ReactNode, number] => {
    const entries: ReactNode[] = [];
    let index = start;
    while (index < block.items.length && (depths[index] ?? 0) >= depth) {
      const item = block.items[index] as TextViewListItem;
      const own = index;
      index += 1;
      let nested: ReactNode = null;
      if (index < block.items.length && (depths[index] ?? 0) > depth) {
        [nested, index] = level(index, depth + 1);
      }
      entries.push(
        <li key={own} {...placeAttrs(block.page, item.bbox, block.id)} data-item={own}>
          {marked(item.text, mark?.blockId === block.id && mark.item === own ? mark : null)}
          {nested}
        </li>,
      );
    }
    const List = block.ordered ? 'ol' : 'ul';
    return [
      <List key={start} data-depth={depth}>
        {entries}
      </List>,
      index,
    ];
  };
  return <>{level(0, 0)[0]}</>;
}

/** A crop of the page: its box reserved from the aspect ratio, the image drawn when near. */
function Crop({
  crops,
  page,
  bbox,
  label,
  onPress,
  className,
  fraction = 1,
}: {
  readonly crops: ImageCrops;
  readonly page: number;
  readonly bbox: { x: number; y: number; width: number; height: number };
  readonly label: string;
  readonly className?: string | undefined;
  /** The crop's share of the column's width. */
  readonly fraction?: number | undefined;
  readonly onPress: () => void;
}) {
  const { x, y, width, height } = bbox;
  const box = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    let made: string | undefined;
    const control = new AbortController();
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const wide = Math.ceil(element.clientWidth * (window.devicePixelRatio || 1));
        crops.render(page, { x, y, width, height }, wide, control.signal).then(
          (blob) => {
            if (control.signal.aborted) return;
            made = URL.createObjectURL(blob);
            setUrl(made);
          },
          () => {
            // A crop that failed leaves its box; "Show page" is still there.
          },
        );
      },
      { rootMargin: '100% 0px' },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      control.abort();
      if (made) URL.revokeObjectURL(made);
    };
  }, [crops, page, x, y, width, height]);
  return (
    <button
      ref={box}
      type="button"
      // An image box, not a control of the chrome: Button and IconButton are for bar actions.
      // eslint-disable-next-line recto/q9-controls
      className={[styles.crop, className].filter(Boolean).join(' ')}
      style={
        {
          aspectRatio: `${Math.max(1, width)} / ${Math.max(1, height)}`,
          '--rv-fraction': fraction,
        } as CSSProperties
      }
      aria-label={label}
      onClick={onPress}
      data-loaded={url ? '' : undefined}
    >
      {url ? <img src={url} alt={label} className={styles.cropImage} /> : null}
    </button>
  );
}

function Skeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true" data-testid="text-view-skeleton">
      {[4, 3, 4].map((lines, group) => (
        <div key={group} className={styles.skeletonGroup}>
          {Array.from({ length: lines }, (_, line) => (
            <span
              key={line}
              className={styles.skeletonLine}
              data-last={line === lines - 1 ? '' : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The scanned-page card (EDN-27): what to do, the pack it costs, the run's progress. */
export function ScanPrompt({
  pages,
  all,
  scan,
  lead = true,
}: {
  readonly pages: readonly number[];
  readonly all: boolean;
  readonly scan: ScanControl;
  /** The card that speaks the progress: one status for a run that several cards share. */
  readonly lead?: boolean;
}) {
  const { info, run, failed, loadInfo } = scan;
  useEffect(() => loadInfo(), [loadInfo]);
  const running = run !== null && pages.some((page) => run.pages.has(page));
  if (running && run) {
    return (
      <div role={lead ? 'status' : undefined} className={styles.scanRun}>
        <Progress
          value={run.total > 0 ? (run.done / run.total) * 100 : null}
          label={m.text_view_ocr_progress({ done: run.done, total: run.total })}
          hideValue
        />
      </div>
    );
  }
  return (
    <>
      <Button variant="standard" onClick={() => scan.start(pages)} data-testid="text-view-ocr">
        {all ? m.text_view_ocr_all() : m.text_view_ocr()}
      </Button>
      {info && info.downloadBytes > 0 ? (
        <p className={styles.cardNote}>
          {m.text_view_ocr_pack({
            language: info.languageLabel,
            size: formatSize(info.downloadBytes),
          })}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className={styles.cardNote}>
          {m.ocr_failed_short()}
        </p>
      ) : null}
    </>
  );
}

function PageBody({
  page,
  state,
  loader,
  crops,
  mark,
  scan,
  allScans,
  onShowPage,
}: TextPageProps & { readonly state: TextViewPage }) {
  if (state.needsOcr) {
    const whole = { x: 0, y: 0, width: state.size.width, height: state.size.height };
    return (
      <div
        className={styles.card}
        data-testid="text-view-scanned"
        data-anchor=""
        data-page={page}
        data-y={0}
        data-h={state.size.height}
      >
        <Crop
          crops={crops}
          page={page}
          bbox={whole}
          label={m.text_view_show_page()}
          className={styles.scanThumb}
          onPress={() => onShowPage({ page, y: 0 })}
        />
        {allScans ? null : (
          <>
            <p className={styles.cardText}>{m.text_view_scanned()}</p>
            <ScanPrompt
              pages={scanGroup(loader, page)}
              all={false}
              scan={scan}
              lead={page === scanGroup(loader, page)[0]}
            />
          </>
        )}
      </div>
    );
  }
  return (
    <>
      {state.blocks.map((block) => {
        const own = mark?.blockId === block.id ? mark : null;
        switch (block.kind) {
          case 'heading': {
            const Heading = `h${Math.min(5, Math.max(2, block.level + 1))}` as 'h2';
            return (
              <Heading
                key={block.id}
                {...placeAttrs(page, block.bbox, block.id)}
                data-level={block.level}
              >
                {marked(block.text, own)}
              </Heading>
            );
          }
          case 'paragraph':
            return (
              <p key={block.id} {...placeAttrs(page, block.bbox, block.id)}>
                {marked(block.text, own)}
              </p>
            );
          case 'list':
            return (
              <div key={block.id} className={styles.list} data-testid="text-view-list">
                <ListItems block={block} mark={own} />
              </div>
            );
          case 'image':
            return (
              <figure
                key={block.id}
                className={styles.figure}
                {...placeAttrs(page, block.bbox, block.id)}
              >
                <Crop
                  crops={crops}
                  page={page}
                  bbox={block.bbox}
                  label={m.text_view_image({ page: page + 1 })}
                  fraction={Math.min(1, block.bbox.width / Math.max(1, state.size.width))}
                  onPress={() => onShowPage({ page, y: block.bbox.y })}
                />
              </figure>
            );
        }
      })}
    </>
  );
}

export function TextPage(props: TextPageProps) {
  const { page, loader } = props;
  const onShowPage = props.onShowPage;
  const state = useSyncExternalStore(
    (listener) => loader.subscribe(listener),
    () => loader.peek(page),
  );
  return (
    <section
      className={styles.page}
      id={`page-${page + 1}`}
      data-page={page}
      data-anchor=""
      data-y={0}
      data-h={0}
      data-state={typeof state === 'string' ? state : 'ready'}
    >
      <div className={styles.pageHead} data-anchor="" data-page={page} data-y={0} data-h={0}>
        <div
          role="separator"
          aria-label={m.text_view_page({ page: page + 1 })}
          className={styles.pageLabel}
        >
          <span aria-hidden="true">{m.text_view_page({ page: page + 1 })}</span>
        </div>
        <Button
          variant="quiet"
          size="sm"
          className={styles.showPage}
          onClick={() => onShowPage({ page, y: 0 })}
          data-testid="text-view-show-page"
        >
          {m.text_view_show_page()}
        </Button>
      </div>
      {state === 'loading' ? <Skeleton /> : null}
      {state === 'failed' ? (
        <div className={styles.card} role="group" data-testid="text-view-failed">
          <p className={styles.cardText}>{m.text_view_failed()}</p>
          <div className={styles.cardActions}>
            <Button variant="standard" onClick={() => void loader.retry(page)}>
              {m.text_view_retry()}
            </Button>
            <Button variant="quiet" onClick={() => onShowPage({ page, y: 0 })}>
              {m.text_view_show_page()}
            </Button>
          </div>
        </div>
      ) : null}
      {typeof state === 'object' ? <PageBody {...props} state={state} /> : null}
    </section>
  );
}
