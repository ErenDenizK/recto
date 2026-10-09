/**
 * One Pages grid section (`components/06-navigation.md` PG3): in All open a header (collapse
 * toggle, source colour tags, title, page count, the honesty badges that change what a page
 * operation does, section menu), and a `role="grid"` of the rows the virtualizer currently
 * shows. In This document the strip's title stands for the section's (PG2), so it has none.
 * The header stays in flow on the canvas and sticks below the strip's pieces: no glass, so no
 * frosted band under the strip (PG3 Issue 8); while it sticks, the canvas fills the room above
 * it, so no sliver of cells shows between it and the pieces (owner feedback F4).
 *
 * The header is one quiet line (owner feedback F4, "Better UI"; system-audit-2026-10 I-33): the
 * name in body 600, then its count and a tag only for what a page operation must respect
 * (encrypted, repaired, XFA, signed) as footnote text after middle dots, each with a tooltip
 * that says what it changes; no chips. A form and a structure tree are facts about the file,
 * not about its pages: the Document info sheet lists them (`DocumentFacts`).
 *
 * The section element is a drop target for page drags, tab drags and OS files; the table
 * computes the insertion gap from pointer coordinates (dnd/geometry.ts), so targets carry
 * only the section's document id.
 */
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/adapter/drop-target-for-external';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine';
import { containsFiles } from '@atlaskit/pragmatic-drag-and-drop/utils/contains-files';
import {
  type DocumentId,
  effectiveLabel,
  type PageId,
  pageTotalRotation,
  type SourceId,
  type Workspace,
} from '@pdf-editor/document-model';
import { Menu } from '@base-ui/react/menu';
import { useEffect, useRef } from 'react';

import { useDropHighlight } from '../dnd/drag-store';
import { cutPartAt, useSplitPreview } from '../pages-sheets/split-preview';
import { type GridMetrics, GRID, gapBar, type SectionLayout } from '../dnd/geometry';
import { isPageDrag, isTabDrag } from '../dnd/page-drag';
import { m } from '../i18n';
import { displaySize, fitInBox } from '../pages/page-geometry';
import { announce } from '../shell/announcer';
import { SOURCE_BADGES } from '../document/DocumentFacts';
import { selectAllOf, useSelectionStore } from '../state/selection-store';
import { useUiStore } from '../state/ui-store';
import {
  documentSources,
  pagesPhrase,
  type SourceFileInfo,
  useWorkspaceStore,
} from '../state/workspace-store';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import menuStyles from '../ui/Menu.module.css';
import { Tooltip } from '../ui/Tooltip';
import { selectParity } from './arrange-actions';
import type { ShownSection } from './arrange-data';
import { outlineTargets } from './arrange-data';
import styles from './ArrangeView.module.css';
import { InlineTitleEditor } from './InlineTitleEditor';
import { PageCell } from './PageCell';
import { contentFrame } from './ResizedContent';
import { SectionMenuEntries } from './SectionMenuEntries';
import { startRename } from './section-operations';

/** DOM attribute that tells the shell's window-wide file drop to leave a drop alone. */
export const FILE_DROP_ZONE_ATTRIBUTE = 'data-file-drop-zone';

/** The honesty badges a section header shows: the facts a page operation must respect. */
const SECTION_BADGES: ReadonlySet<string> = new Set([
  'encrypted',
  'repaired',
  'hasXfa',
  'hasSignatures',
]);

export function sectionDomId(documentId: DocumentId, part: 'title' | 'grid' | 'menu'): string {
  return `arrange-${part}-${documentId}`;
}

interface ArrangeSectionProps {
  readonly section: ShownSection;
  readonly layout: SectionLayout<DocumentId>;
  readonly metrics: GridMetrics;
  /** Row indices to render (the virtualizer's range). */
  readonly rows: readonly number[];
  readonly ws: Workspace;
  readonly files: Readonly<Record<SourceId, SourceFileInfo>>;
  readonly viewTop: number;
  readonly viewBottom: number;
  /** Roving tabindex: the section's one tabbable cell. */
  readonly tabbableId: PageId | undefined;
  /** The page that was current on the page view (the lime ring, §2.2), if in this section. */
  readonly currentId?: PageId | undefined;
}

export function ArrangeSection({
  section,
  layout,
  metrics,
  rows,
  ws,
  files,
  viewTop,
  viewBottom,
  tabbableId,
  currentId,
}: ArrangeSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const blobs = useWorkspaceStore((s) => s.blobs);
  // Split's cut lines while its sheet is open (S13).
  const split = useSplitPreview((s) =>
    s.preview?.documentId === section.doc.id ? s.preview : null,
  );
  const { doc } = section;
  const documentId = doc.id;
  const outlined = useDropHighlight((s) => {
    const h = s.highlight;
    if (h === null) return false;
    if (h.kind === 'section') return h.section === documentId;
    return h.kind === 'gap' && h.files && h.section === documentId;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const data = { type: 'section', documentId };
    return combine(
      dropTargetForElements({
        element,
        getData: () => data,
        canDrop: ({ source }) => isPageDrag(source.data) || isTabDrag(source.data),
        getDropEffect: ({ input }) => (input.altKey ? 'copy' : 'move'),
      }),
      dropTargetForExternal({
        element,
        getData: () => data,
        canDrop: containsFiles,
        getDropEffect: () => 'copy',
      }),
    );
  }, [documentId]);

  const pages = doc.pages;
  const outline = outlineTargets(doc);
  const height = layout.bottom - layout.top - GRID.sectionGap;

  return (
    <section
      ref={ref}
      className={styles.section}
      // The header lines up with the centred columns (`--grid-pad`, ArrangeView.module.css).
      style={{ top: layout.top, height, ['--grid-pad' as string]: `${metrics.padX}px` }}
      aria-labelledby={section.header ? sectionDomId(documentId, 'title') : undefined}
      aria-label={section.header ? undefined : doc.title}
      data-section-id={documentId}
      data-headed={section.header || undefined}
      data-drop-outline={outlined || undefined}
      {...{ [FILE_DROP_ZONE_ATTRIBUTE]: '' }}
    >
      {section.header ? <SectionHeader section={section} ws={ws} files={files} /> : null}
      {section.collapsed ? null : (
        <div
          id={sectionDomId(documentId, 'grid')}
          role="grid"
          aria-labelledby={section.header ? sectionDomId(documentId, 'title') : undefined}
          aria-label={section.header ? undefined : doc.title}
          aria-multiselectable="true"
          aria-rowcount={Math.max(1, layout.rows)}
          aria-colcount={metrics.columns}
          className={styles.grid}
          style={{ height: layout.gridHeight }}
        >
          {pages.length === 0 ? (
            <div role="row" aria-rowindex={1} className={styles.row} style={{ height: '100%' }}>
              <div role="gridcell" aria-colindex={1} className={styles.emptyRow}>
                {m.section_empty()}
              </div>
            </div>
          ) : (
            rows.map((row) => {
              const top = layout.gridTop + row * metrics.rowHeight;
              const visible = top + metrics.rowHeight > viewTop && top < viewBottom;
              const start = row * metrics.columns;
              return (
                <div
                  key={row}
                  role="row"
                  aria-rowindex={row + 1}
                  className={styles.row}
                  style={{
                    transform: `translateY(${row * metrics.rowHeight}px)`,
                    gridTemplateColumns: `repeat(${metrics.columns}, ${metrics.cellWidth}px)`,
                    columnGap: metrics.gapX,
                    paddingInline: metrics.padX,
                  }}
                >
                  {pages.slice(start, start + metrics.columns).map((page, offset) => {
                    const index = start + offset;
                    const size = displaySize(ws, page);
                    const fitted = fitInBox(size, metrics.cellWidth, metrics.boxHeight);
                    const ref = page.ref;
                    const file = ref.kind === 'source' ? files[ref.source] : undefined;
                    const frame = contentFrame(ws, page);
                    return (
                      <PageCell
                        key={page.id}
                        pageId={page.id}
                        documentId={documentId}
                        index={index}
                        count={pages.length}
                        column={offset}
                        label={safeLabel(ws, doc, index)}
                        sourceId={ref.kind === 'source' ? ref.source : undefined}
                        sourceIndex={ref.kind === 'source' ? ref.index : 0}
                        blobId={ref.kind === 'image' ? ref.blob : undefined}
                        sourceName={
                          file?.name ??
                          (ref.kind === 'source'
                            ? ws.sources[ref.source]?.name
                            : ref.kind === 'image'
                              ? blobs[ref.blob]?.name
                              : undefined)
                        }
                        colorIndex={file?.colorIndex ?? 0}
                        rotation={page.rotation}
                        totalRotation={safeRotation(ws, page)}
                        widthPt={size.width}
                        heightPt={size.height}
                        contentLeft={frame?.left}
                        contentTop={frame?.top}
                        contentWidth={frame?.width}
                        contentHeight={frame?.height}
                        contentWidthPt={frame?.widthPt}
                        contentHeightPt={frame?.heightPt}
                        thumbWidth={fitted.width}
                        thumbHeight={fitted.height}
                        cellWidth={metrics.cellWidth}
                        boxHeight={metrics.boxHeight}
                        outlined={outline.has(page.id)}
                        tabbable={page.id === tabbableId}
                        current={page.id === currentId}
                        cutPart={cutPartAt(split, documentId, index)}
                        parts={split?.parts}
                        visible={visible}
                      />
                    );
                  })}
                </div>
              );
            })
          )}
          <InsertionBar documentId={documentId} metrics={metrics} />
        </div>
      )}
    </section>
  );
}

function safeLabel(ws: Workspace, doc: ShownSection['doc'], index: number): string {
  try {
    return effectiveLabel(ws, doc, index);
  } catch {
    return String(index + 1);
  }
}

function safeRotation(ws: Workspace, page: ShownSection['doc']['pages'][number]): number {
  try {
    return pageTotalRotation(ws, page);
  } catch {
    return page.rotation;
  }
}

/** The 2px accent bar in the gutter of the current drop gap (spec §3). */
function InsertionBar({
  documentId,
  metrics,
}: {
  readonly documentId: DocumentId;
  readonly metrics: GridMetrics;
}) {
  const highlight = useDropHighlight((s) =>
    s.highlight?.kind === 'gap' && s.highlight.section === documentId ? s.highlight : null,
  );
  if (highlight === null) return null;
  const bar = gapBar(metrics, highlight.gap);
  return (
    <div
      className={styles.insertionBar}
      data-testid="insertion-bar"
      data-index={highlight.gap.index}
      data-duplicate={highlight.duplicate || undefined}
      aria-hidden="true"
      style={{ height: bar.height, transform: `translate(${bar.x}px, ${bar.y}px)` }}
    />
  );
}

function SectionHeader({
  section,
  ws,
  files,
}: {
  readonly section: ShownSection;
  readonly ws: Workspace;
  readonly files: Readonly<Record<SourceId, SourceFileInfo>>;
}) {
  const { doc, collapsed } = section;
  const setCollapsed = useUiStore((s) => s.setArrangeCollapsed);
  const renaming = useUiStore(
    (s) => s.renaming?.documentId === doc.id && s.renaming.surface === 'section',
  );
  const sources = documentSources(doc);
  const badges = SOURCE_BADGES.filter(
    (badge) =>
      SECTION_BADGES.has(badge.flag) &&
      sources.some((id) => ws.sources[id]?.flags[badge.flag] === true),
  );
  const toggle = () => {
    setCollapsed(doc.id, !collapsed);
    announce(
      collapsed
        ? m.announce_section_expanded({ title: doc.title })
        : m.announce_section_collapsed({ title: doc.title }),
    );
  };

  return (
    <header className={styles.header} data-section-header="">
      <IconButton
        size="row"
        className={styles.headerButton}
        aria-expanded={!collapsed}
        aria-controls={collapsed ? undefined : sectionDomId(doc.id, 'grid')}
        label={
          collapsed
            ? m.section_expand_label({ title: doc.title })
            : m.section_collapse_label({ title: doc.title })
        }
        icon={<Icon name="caret-down" />}
        onClick={toggle}
      />
      <span className={styles.sectionTags}>
        {sources.map((id) => {
          const file = files[id];
          const name = file?.name ?? ws.sources[id]?.name ?? m.unknown_file();
          return (
            <span
              key={id}
              className={styles.sectionTag}
              data-tag={file?.colorIndex ?? 0}
              title={name}
              role="img"
              aria-label={m.section_pages_from({ name })}
            />
          );
        })}
      </span>
      {renaming ? (
        <InlineTitleEditor
          documentId={doc.id}
          title={doc.title}
          className={styles.titleEditor}
          onDone={() => {
            requestAnimationFrame(() =>
              document.getElementById(sectionDomId(doc.id, 'menu'))?.focus(),
            );
          }}
        />
      ) : (
        <h2
          id={sectionDomId(doc.id, 'title')}
          className={styles.sectionTitle}
          title={doc.title}
          onDoubleClick={() => startRename(doc.id, 'section')}
        >
          {doc.title}
        </h2>
      )}
      <span className={styles.sectionMeta}>
        <span className={styles.sectionCount}>{pagesPhrase(doc.pages.length)}</span>
        {badges.map((badge) => (
          <Tooltip key={badge.flag} label={badge.explanation}>
            <span className={styles.badge} data-section-tag={badge.flag}>
              {badge.label}
              <span className="visually-hidden">{`: ${badge.explanation}`}</span>
            </span>
          </Tooltip>
        ))}
      </span>
      <span className={styles.headerSpacer} />
      <SectionMenu section={section} />
    </header>
  );
}

function SectionMenu({ section }: { readonly section: ShownSection }) {
  const { doc, collapsed } = section;
  const ui = useUiStore.getState;
  const apply = useSelectionStore((s) => s.apply);
  const focused = useSelectionStore((s) => s.focused);

  const builtIn: { key: string; label: string; run: () => void; disabled?: boolean }[] = [
    {
      key: 'collapse',
      label: collapsed ? m.section_expand() : m.section_collapse(),
      run: () => ui().setArrangeCollapsed(doc.id, !collapsed),
    },
    {
      key: 'select-all',
      label: m.cmd_select_all(),
      disabled: doc.pages.length === 0,
      run: () => {
        apply(
          selectAllOf(
            doc.pages.map((p) => p.id),
            focused,
          ),
        );
        announce(
          m.announce_selected_in({ pages: pagesPhrase(doc.pages.length), title: doc.title }),
        );
      },
    },
    {
      key: 'odd',
      label: m.cmd_select_odd(),
      disabled: doc.pages.length === 0,
      run: () => selectParity(doc.id, 'odd'),
    },
    {
      key: 'even',
      label: m.cmd_select_even(),
      disabled: doc.pages.length < 2,
      run: () => selectParity(doc.id, 'even'),
    },
  ];

  return (
    <Menu.Root>
      <Menu.Trigger
        id={sectionDomId(doc.id, 'menu')}
        className={styles.headerButton}
        aria-label={m.section_actions_label({ title: doc.title })}
      >
        <Icon name="dots-three" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup} data-testid="section-menu">
            {builtIn.map((item) => (
              <Menu.Item
                key={item.key}
                className={menuStyles.item}
                disabled={item.disabled ?? false}
                onClick={item.run}
              >
                <span className={menuStyles.label}>{item.label}</span>
              </Menu.Item>
            ))}
            <SectionMenuEntries documentId={doc.id} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
