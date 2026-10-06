/**
 * The compact reader's sheets (ADR-0033 §2.3): Pages (a thumbnail grid to jump), Contents
 * (the file's outline), Go to page, Document info and About. One opens at a time, from the
 * capsule or the ⋯ menu; a jump closes its sheet and lands the page under the top bar.
 *
 * The compact edition has no Settings sheet; its settings besides the Library's language
 * switch are Theme (ADR-0022 §2.4, spec D3-7) and Reduce motion (language.md §7.6, A-9), at the
 * end of About as the full edition's own rows (`settings/ThemeRow.tsx`,
 * `settings/ReduceMotionRow.tsx`, the same `appearance-store` fields), so a person who wants
 * light on a dark phone, or less motion than their system asks for, can say so on a phone too.
 */
import type {
  OutlineNode,
  Rect,
  VirtualDocument,
  VirtualPage,
  Workspace,
} from '@pdf-editor/document-model';
import {
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { RENDER_PRIORITY } from '../../engine/engine-service';
import { formatFileSize } from '../../home/home-model';
import { getLocale, m } from '../../i18n';
import { PageCanvas } from '../../pages/PageCanvas';
import { displaySize, fitInBox } from '../../pages/page-geometry';
import { contentFrame, ResizedContent } from '../../stage/ResizedContent';
import { ReduceMotionRow } from '../../settings/ReduceMotionRow';
import { ThemeRow } from '../../settings/ThemeRow';
import { Section } from '../../settings/rows';
import { useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Icon } from '../../ui/Icon';
import { documentLabels, hasCustomLabels, parseGoTo } from '../../viewer/navigation';
import { BUILD_INFO, LICENSE_ID, PRODUCT_NAME, REPOSITORY_URL } from '../about/build-info';
import { AppGlyph } from '../AppGlyph';
import { announce } from '../announcer';
import { openableUrl } from '../OutlinePanel.tree';
import { useFileInfo } from './CompactChrome';
import { CompactSheet } from './CompactSheet';
import { closeSheet, useCompactStore } from './compact-store';
import controls from './controls.module.css';
import styles from './CompactSheets.module.css';
import { visibleRange } from './reader-layout';

export function CompactSheets({ doc }: { readonly doc: VirtualDocument }) {
  const sheet = useCompactStore((s) => s.sheet);
  return (
    <>
      <CompactSheet
        open={sheet === 'pages'}
        onClose={closeSheet}
        title={m.compact_pages()}
        size="tall"
        testId="compact-pages-sheet"
      >
        <PagesGrid doc={doc} />
      </CompactSheet>
      <CompactSheet
        open={sheet === 'contents'}
        onClose={closeSheet}
        title={m.compact_contents()}
        size="tall"
        testId="compact-contents-sheet"
      >
        <Contents doc={doc} />
      </CompactSheet>
      <GoToSheet doc={doc} open={sheet === 'goto'} />
      <CompactSheet
        open={sheet === 'info'}
        onClose={closeSheet}
        title={m.compact_info()}
        testId="compact-info-sheet"
      >
        <DocumentInfo doc={doc} />
      </CompactSheet>
      <CompactSheet
        open={sheet === 'about'}
        onClose={closeSheet}
        title={m.about_command({ name: PRODUCT_NAME })}
        testId="compact-about-sheet"
      >
        <About />
      </CompactSheet>
    </>
  );
}

/** Jumps to a page (under the top bar), closes the sheet and says where it went. */
function jumpTo(doc: VirtualDocument, index: number, reveal?: { readonly reveal?: Rect }) {
  const page = doc.pages[index];
  if (!page) return;
  closeSheet();
  useViewStore.getState().scrollToPage(page.id, reveal);
  announce(m.cell_label({ position: index + 1, count: doc.pages.length }));
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const GRID_PADDING = 8;
const GRID_GAP = 12;
const MIN_CELL = 104;
const THUMB_ASPECT = 1.35;
const LABEL_HEIGHT = 24;

/** A virtualised grid of thumbnails: only the rows near the view are mounted. */
function PagesGrid({ doc }: { readonly doc: VirtualDocument }) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const current = useViewStore((s) => s.currentPage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ width: 0, height: 0, top: 0 });
  const labels = documentLabels(ws, doc);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const read = () =>
      setView({ width: el.clientWidth, height: el.clientHeight, top: el.scrollTop });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    el.addEventListener('scroll', read, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', read);
    };
  }, []);

  const inner = Math.max(0, view.width - 2 * GRID_PADDING);
  const columns = Math.max(3, Math.floor((inner + GRID_GAP) / (MIN_CELL + GRID_GAP)));
  const cell = Math.max(1, (inner - (columns - 1) * GRID_GAP) / columns);
  const thumb = Math.round(cell * THUMB_ASPECT);
  const rowHeight = thumb + LABEL_HEIGHT + GRID_GAP;
  const rowCount = Math.ceil(doc.pages.length / columns);
  const rowBoxes = Array.from({ length: rowCount }, (_, r) => ({
    top: GRID_PADDING + r * rowHeight,
    left: 0,
    width: inner,
    height: rowHeight,
  }));
  const rows = visibleRange(rowBoxes, view.top, view.height, view.height);

  // Opens on the page being read, centred.
  const centred = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || centred.current || view.width === 0) return;
    centred.current = true;
    const row = Math.floor(current / columns);
    el.scrollTop = Math.max(0, GRID_PADDING + row * rowHeight - (el.clientHeight - rowHeight) / 2);
  }, [view.width, columns, rowHeight, current]);

  const cells = [];
  if (view.width > 0) {
    for (let r = rows.first; r <= rows.last; r++) {
      for (let c = 0; c < columns; c++) {
        const index = r * columns + c;
        const page = doc.pages[index];
        if (!page) break;
        const label = labels[index] ?? String(index + 1);
        cells.push(
          <Thumbnail
            key={page.id}
            ws={ws}
            page={page}
            index={index}
            count={doc.pages.length}
            label={label}
            current={index === current}
            box={{
              left: GRID_PADDING + c * (cell + GRID_GAP),
              top: GRID_PADDING + r * rowHeight,
              width: cell,
              height: thumb,
            }}
            onPick={() => jumpTo(doc, index)}
          />,
        );
      }
    }
  }

  return (
    <div ref={scrollRef} className={styles.gridScroll} data-testid="compact-pages-grid">
      <div
        className={styles.grid}
        role="list"
        style={{ height: GRID_PADDING * 2 + rowCount * rowHeight - GRID_GAP }}
      >
        {cells}
      </div>
    </div>
  );
}

function Thumbnail({
  ws,
  page,
  index,
  count,
  label,
  current,
  box,
  onPick,
}: {
  readonly ws: Workspace;
  readonly page: VirtualPage;
  readonly index: number;
  readonly count: number;
  readonly label: string;
  readonly current: boolean;
  readonly box: { left: number; top: number; width: number; height: number };
  readonly onPick: () => void;
}) {
  const size = displaySize(ws, page);
  const fitted = fitInBox(size, box.width, box.height);
  const frame = contentFrame(ws, page);
  const sourceId = page.ref.kind === 'source' ? page.ref.source : undefined;
  const name =
    label !== String(index + 1)
      ? m.cell_label_with_label({ position: index + 1, label, count })
      : m.cell_label({ position: index + 1, count });
  return (
    <div
      role="listitem"
      className={styles.cell}
      style={{ left: box.left, top: box.top, width: box.width }}
    >
      <button
        type="button"
        className={styles.thumbButton}
        style={{ height: box.height }}
        aria-label={name}
        aria-current={current ? 'page' : undefined}
        data-page-index={index}
        onClick={onPick}
      >
        <span className={styles.thumb} style={{ width: fitted.width, height: fitted.height }}>
          <ResizedContent frame={frame}>
            <PageCanvas
              sourceId={sourceId}
              blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
              index={page.ref.kind === 'source' ? page.ref.index : 0}
              rotation={page.rotation}
              widthPt={frame?.widthPt ?? size.width}
              heightPt={frame?.heightPt ?? size.height}
              cssWidth={frame ? frame.width * fitted.width : fitted.width}
              priority={RENDER_PRIORITY.visible}
            />
          </ResizedContent>
        </span>
      </button>
      <span className={styles.thumbLabel} aria-hidden="true" data-current={current || undefined}>
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contents
// ---------------------------------------------------------------------------

interface ContentsRow {
  readonly key: string;
  readonly node: OutlineNode;
  readonly level: number;
}

/** Every entry of the outline, in reading order, with its depth (a phone shows them all). */
export function flattenContents(nodes: readonly OutlineNode[]): ContentsRow[] {
  const rows: ContentsRow[] = [];
  const visit = (list: readonly OutlineNode[], prefix: string, level: number) => {
    list.forEach((node, index) => {
      const key = prefix === '' ? String(index) : `${prefix}.${index}`;
      rows.push({ key, node, level });
      visit(node.children, key, level + 1);
    });
  };
  visit(nodes, '', 1);
  return rows;
}

function Contents({ doc }: { readonly doc: VirtualDocument }) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const labels = documentLabels(ws, doc);
  const pageIndex = new Map(doc.pages.map((page, index) => [page.id, index]));
  const rows = flattenContents(doc.outline);
  return (
    <ul className={styles.contents} aria-label={m.outline_tree_label({ title: doc.title })}>
      {rows.map(({ key, node, level }) => {
        const destination = node.destination;
        const title = node.title.trim() || m.outline_untitled();
        const indent = { paddingInlineStart: 12 + Math.min(level - 1, 4) * 16 };
        if (destination?.kind === 'page') {
          const index = pageIndex.get(destination.page);
          if (index !== undefined) {
            const top = destination.view?.top;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={styles.contentsRow}
                  style={indent}
                  data-level={level}
                  onClick={() =>
                    // A zero-size region aligns its top under the top bar (CompactReader).
                    jumpTo(
                      doc,
                      index,
                      top === undefined
                        ? undefined
                        : {
                            reveal: { x: destination.view?.left ?? 0, y: top, width: 0, height: 0 },
                          },
                    )
                  }
                >
                  <span className={styles.contentsTitle}>{title}</span>
                  <span className={styles.contentsPage}>{labels[index] ?? index + 1}</span>
                </button>
              </li>
            );
          }
        }
        if (destination?.kind === 'uri') {
          const url = openableUrl(destination.uri);
          if (url) {
            return (
              <li key={key}>
                <a
                  className={styles.contentsRow}
                  style={indent}
                  href={url.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.contentsTitle}>
                    {title}
                    <span className={styles.contentsHint}>
                      {m.compact_contents_external({
                        host: url.protocol === 'mailto:' ? url.pathname : url.host,
                      })}
                    </span>
                  </span>
                  <Icon name="arrow-up-right" className={styles.contentsIcon} />
                </a>
              </li>
            );
          }
        }
        return (
          <li key={key}>
            <span className={styles.contentsRow} style={indent} aria-disabled="true">
              <span className={styles.contentsTitle}>
                {title}
                {destination?.kind === 'unresolved' ? (
                  <span className={styles.contentsHint}>{m.outline_unresolved()}</span>
                ) : null}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Go to page
// ---------------------------------------------------------------------------

function GoToSheet({ doc, open }: { readonly doc: VirtualDocument; readonly open: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <CompactSheet
      open={open}
      onClose={closeSheet}
      title={m.goto_title()}
      testId="compact-goto-sheet"
      initialFocus={inputRef}
    >
      {open ? <GoToForm doc={doc} inputRef={inputRef} /> : null}
    </CompactSheet>
  );
}

function GoToForm({
  doc,
  inputRef,
}: {
  readonly doc: VirtualDocument;
  readonly inputRef: RefObject<HTMLInputElement | null>;
}) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const labels = documentLabels(ws, doc);
  const custom = hasCustomLabels(labels);
  const [value, setValue] = useState('');
  const hintId = useId();
  const target = parseGoTo(value, labels);
  const total = doc.pages.length;
  let hint: string;
  if (target.kind === 'page') {
    const label = labels[target.index] ?? '';
    hint =
      custom && label !== String(target.index + 1)
        ? m.goto_preview_label({ number: target.index + 1, total, label })
        : m.goto_preview({ number: target.index + 1, total });
  } else if (target.kind === 'invalid') hint = m.goto_invalid({ value: value.trim() });
  else {
    hint = custom
      ? m.goto_hint_labels({ first: labels[0] ?? '1', last: labels[labels.length - 1] ?? '' })
      : m.goto_hint({ total });
  }
  const onSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (target.kind === 'page') jumpTo(doc, target.index);
  };
  return (
    <form className={styles.goto} onSubmit={onSubmit}>
      <div className={styles.gotoRow}>
        <input
          ref={inputRef}
          className={styles.gotoInput}
          type="text"
          inputMode={custom ? 'text' : 'numeric'}
          enterKeyHint="go"
          autoComplete="off"
          aria-label={m.goto_label()}
          aria-describedby={hintId}
          aria-invalid={target.kind === 'invalid' || undefined}
          placeholder={String(useViewStore.getState().currentPage + 1)}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" className={controls.primary} disabled={target.kind !== 'page'}>
          {m.goto_go()}
        </button>
      </div>
      <p
        id={hintId}
        className={styles.gotoHint}
        data-invalid={target.kind === 'invalid' || undefined}
      >
        {hint}
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Document info and About
// ---------------------------------------------------------------------------

function DocumentInfo({ doc }: { readonly doc: VirtualDocument }) {
  const file = useFileInfo(doc);
  const locale = getLocale();
  const producer = doc.metadata.producer?.trim();
  return (
    <dl className={styles.facts}>
      <Fact label={m.info_name()} testId="compact-info-name">
        {file?.name ?? doc.title}
      </Fact>
      <Fact label={m.info_pages()} testId="compact-info-pages">
        {doc.pages.length}
      </Fact>
      {file ? (
        <Fact label={m.info_size()} testId="compact-info-size">
          {formatFileSize(file.size, locale)}
        </Fact>
      ) : null}
      {producer ? (
        <Fact label={m.compact_info_producer()} testId="compact-info-producer">
          {producer}
        </Fact>
      ) : null}
    </dl>
  );
}

function Fact({
  label,
  testId,
  children,
}: {
  readonly label: string;
  readonly testId: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue} data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

function About() {
  const date = new Date(BUILD_INFO.buildDate);
  const built = Number.isNaN(date.getTime())
    ? BUILD_INFO.buildDate
    : new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long' }).format(date);
  return (
    <div className={styles.about}>
      <div className={styles.aboutHead}>
        <AppGlyph size={28} />
        <div>
          <p className={styles.aboutName}>{PRODUCT_NAME}</p>
          {BUILD_INFO.isPreRelease ? (
            <p className={styles.aboutBadge}>{m.about_public_beta()}</p>
          ) : null}
        </div>
      </div>
      <p className={styles.aboutStatement}>{m.about_files_local()}</p>
      <dl className={styles.facts}>
        <Fact label={m.about_version()} testId="compact-about-version">
          {BUILD_INFO.version}
        </Fact>
        <Fact label={m.about_build_date()} testId="compact-about-date">
          {built}
        </Fact>
        <Fact label={m.about_license()} testId="compact-about-license">
          {LICENSE_ID}
        </Fact>
      </dl>
      <div className={styles.links}>
        <a
          className={styles.link}
          href={BUILD_INFO.releaseNotesUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span>{m.about_release_notes()}</span>
          <Icon name="arrow-up-right" />
          <span className="visually-hidden"> {m.about_new_tab()}</span>
        </a>
        <a className={styles.link} href={REPOSITORY_URL} target="_blank" rel="noreferrer">
          <span>{m.about_source()}</span>
          <Icon name="arrow-up-right" />
          <span className="visually-hidden"> {m.about_new_tab()}</span>
        </a>
      </div>
      <div className={styles.aboutSettings}>
        <Section title={m.appearance_heading()}>
          <ThemeRow />
          <ReduceMotionRow />
        </Section>
      </div>
    </div>
  );
}
