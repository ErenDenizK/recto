/**
 * The page pill's menu (`components/01-frame.md` F11 §2, §5, §6): Go to page, Contents (one
 * row), zoom with fit, layout, Show field outlines and Focus. A `dialog` (Base UI `Popover`),
 * since it holds a text field and radio groups.
 *
 * - **Go to page** takes a page number or a page label ("iv", "#3"), as the Go to page dialog
 *   it replaces did (`viewer/navigation.ts`); Enter jumps into the free rectangle, closes the
 *   menu and focuses the page; an unknown page shows "Pages 1–12" under the field and keeps
 *   focus. The field selects its value whenever it takes focus, so typing replaces the page.
 *   Mod+G and Enter open the menu with the field focused; a click or a tap opens it with the
 *   menu focused instead (system-audit-2026-10 §3.8, I-28: pointer-opened surfaces focus the
 *   surface, `ui/initial-focus.ts`), so no ring lights and no on-screen keyboard rises until
 *   the field is pressed.
 * - **Contents** is one row naming the section the current page is in; it opens the sidebar
 *   on Contents, which owns the outline (F11 §6: the menu no longer repeats its entries).
 *   A window with no sidebar (compact, tight) has nothing to open, so there the row discloses
 *   the top-level entries in the menu (`aria-expanded`) rather than doing nothing.
 * - **Zoom** ( − ) 96 % ( + ) and **Fit** Width · Page share one row; the buttons keep the
 *   menu open; Mod+= Mod+- Mod+0 work anywhere. Fit and **layout** Continuous · Single · Two-up
 *   (named in full: Single page, Two pages) are radio groups (`ui/Segmented`); the fit shows as
 *   current while the zoom follows the window.
 * - **Show field outlines** only for a document with fields. **Focus · F** closes the menu and
 *   enters Focus (F13).
 * - **Room** (DSN-9): as wide as its content, at least the recipe's width, never wider than the
 *   free rectangle; it only ever scrolls vertically (`PagePill.module.css`).
 * - Esc closes, focus back on the pill. Guard: none (viewing).
 */
import { Popover } from '@base-ui/react/popover';
import type { VirtualDocument } from '@pdf-editor/document-model';
import {
  type ComponentPropsWithRef,
  type RefObject,
  type SyntheticEvent,
  useId,
  useRef,
  useState,
} from 'react';

import { commandRegistry } from '../../commands/registry';
import { documentSources, useFormStore } from '../../forms/form-store';
import { formatNumber, formatPercent, m } from '../../i18n';
import { revealFor } from '../../outline/current-view';
import { displayTitle, showOutlinePanel } from '../../outline/outline-actions';
import { MAX_ZOOM, MIN_ZOOM, useUiStore } from '../../state/ui-store';
import { READ_LAYOUTS, type ReadLayout, useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Keycaps } from '../../ui/Keycaps';
import { PopoverPopup } from '../../ui/Popover';
import { Segmented } from '../../ui/Segmented';
import { documentLabels, parseGoTo } from '../../viewer/navigation';
import { layoutTitle, setReadLayout } from '../../viewer/viewer-commands';
import { announce } from '../announcer';
import { useCommandShortcut } from '../use-command-shortcut';
import { enterFocus } from './focus-mode';
import { closePillMenu, useFrameStore } from './frame-store';
import styles from './PagePill.module.css';
import { useSizeClass } from './size-class';
import { Icon } from '../../ui/Icon';

/** The pill, or where it rests while away (Markup on a narrow window, a short viewport). */
const pill = () =>
  document.getElementById('page-pill') ??
  document.querySelector<HTMLElement>('[data-frame-layer="band"]');
const focusPage = () => document.querySelector<HTMLElement>('[data-read-viewport]')?.focus();

export function PagePillMenu({ doc }: { readonly doc: VirtualDocument }) {
  const open = useFrameStore((s) => s.pillMenu);
  return (
    <Popover.Root
      open={open !== null}
      onOpenChange={(next) => {
        if (!next) closePillMenu();
      }}
    >
      {open !== null ? <PillMenuPopup doc={doc} /> : null}
    </Popover.Root>
  );
}

function PillMenuPopup({ doc }: { readonly doc: VirtualDocument }) {
  const fieldRef = useRef<HTMLInputElement>(null);
  return (
    <PopoverPopup
      side="top"
      align="end"
      anchor={pill}
      className={styles.menu}
      // Focus mode hides the pill: then the menu shows where the pill was (F11 §6).
      // The field takes focus when the keyboard opened the menu (Mod+G, Enter on the pill);
      // from a click or a tap the popup does (PopoverPopup's pointer rule): focusing the field
      // would light its ring and raise the on-screen keyboard (V2 review item 3; I-28).
      initialFocus={() => fieldRef.current}
      finalFocus={() => pill() ?? document.querySelector<HTMLElement>('[data-read-viewport]')}
      aria-label={m.frame_pill_menu_name()}
      data-testid="page-pill-menu"
    >
      <GoToPage doc={doc} fieldRef={fieldRef} />
      <Contents doc={doc} />
      <ZoomRows />
      <div className={styles.section}>
        {doc.pages.length > 0 ? <FieldOutlines doc={doc} /> : null}
        <FocusRow />
      </div>
    </PopoverPopup>
  );
}

function GoToPage({
  doc,
  fieldRef,
}: {
  readonly doc: VirtualDocument;
  readonly fieldRef: RefObject<HTMLInputElement | null>;
}) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const currentPage = useViewStore((s) => s.currentPage);
  const labels = documentLabels(workspace, doc);
  const total = doc.pages.length;
  const [value, setValue] = useState(() => labels[currentPage] ?? String(currentPage + 1));
  const [invalid, setInvalid] = useState(false);
  const hintId = useId();
  // A press that focuses the field keeps the selection its focus made: the release would
  // otherwise drop a caret into it, and typing would add to the page instead of replacing it.
  const keepSelection = useRef(false);

  const onSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    const target = parseGoTo(value, labels);
    const page = target.kind === 'page' ? doc.pages[target.index] : undefined;
    if (!page) {
      setInvalid(true);
      fieldRef.current?.focus();
      return;
    }
    closePillMenu();
    useViewStore.getState().scrollToPage(page.id);
    announce(m.frame_page_announce({ current: doc.pages.indexOf(page) + 1, total }));
    requestAnimationFrame(focusPage);
  };

  return (
    <form className={styles.goto} onSubmit={onSubmit}>
      <label className={styles.gotoLabel} htmlFor={`${hintId}-field`}>
        {m.goto_title()}
      </label>
      <input
        ref={fieldRef}
        id={`${hintId}-field`}
        className={styles.gotoField}
        inputMode="numeric"
        // A few characters' intrinsic width, so the field never sets the menu's width (DSN-9);
        // it stretches to its column.
        size={4}
        autoComplete="off"
        spellCheck={false}
        disabled={total === 0}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        data-testid="pill-goto"
        onFocus={(event) => {
          // The field arrives holding the current page, selected, so typing replaces it
          // ("1" then 2 gives 2, not 12): on opening, on Mod+G, on Tab back to it and on a press.
          event.currentTarget.select();
          keepSelection.current = true;
        }}
        onMouseUp={(event) => {
          if (keepSelection.current) event.preventDefault();
          keepSelection.current = false;
        }}
        onKeyDown={() => {
          keepSelection.current = false;
        }}
        onBlur={() => {
          keepSelection.current = false;
        }}
        onChange={(event) => {
          setValue(event.target.value);
          setInvalid(false);
        }}
      />
      <span className={styles.gotoOf}>{m.frame_goto_of({ total: formatNumber(total) })}</span>
      <Button type="submit" variant="standard" disabled={total === 0}>
        {m.goto_go()}
      </Button>
      <p
        id={hintId}
        className={styles.gotoHint}
        data-invalid={invalid || undefined}
        aria-live="polite"
      >
        {total === 0
          ? m.frame_goto_no_pages()
          : invalid
            ? m.frame_goto_range({ last: formatNumber(total) })
            : ''}
      </p>
    </form>
  );
}

type OutlineEntry = VirtualDocument['outline'][number];

/**
 * The top-level outline entry the page at `current` is in: the last one that starts on or
 * before it (none before the first entry's page).
 */
export function currentSection(doc: VirtualDocument, current: number): OutlineEntry | undefined {
  const index = new Map(doc.pages.map((page, i) => [page.id, i]));
  let section: OutlineEntry | undefined;
  for (const node of doc.outline) {
    const destination = node.destination;
    if (destination?.kind !== 'page') continue;
    const at = index.get(destination.page);
    if (at !== undefined && at <= current) section = node;
  }
  return section;
}

/** Top-level entries the menu lists where no sidebar can open (the eight of F11 before r15). */
const PILL_CONTENTS_MAX = 8;

function Contents({ doc }: { readonly doc: VirtualDocument }) {
  const currentPage = useViewStore((s) => s.currentPage);
  const frame = useSizeClass();
  // A compact (not compact-height) or a tight window mounts no sidebar (AppShell; 06 N1: a
  // phone keeps Contents in its own sheet), so there the row cannot open one: it discloses the
  // top-level entries in the menu instead of doing nothing.
  const inline = frame.tight || (frame.size === 'compact' && !frame.short);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  if (doc.outline.length === 0) return null;
  const section = currentSection(doc, currentPage);
  return (
    <div className={styles.section}>
      <EntryRow
        data-testid="pill-contents"
        aria-expanded={inline ? expanded : undefined}
        aria-controls={inline && expanded ? listId : undefined}
        onClick={() => {
          if (inline) {
            setExpanded((open) => !open);
            return;
          }
          closePillMenu();
          showOutlinePanel();
        }}
      >
        <span className={styles.entryLabel}>{m.frame_contents()}</span>
        {section ? <span className={styles.entryDetail}>{displayTitle(section)}</span> : null}
        <Icon name="caret-right" className={styles.chevron} aria-hidden="true" />
      </EntryRow>
      {inline && expanded ? <InlineContents doc={doc} id={listId} /> : null}
    </div>
  );
}

/** The top-level entries as rows: a choice jumps, closes the menu and focuses the page. */
function InlineContents({ doc, id }: { readonly doc: VirtualDocument; readonly id: string }) {
  const index = new Map(doc.pages.map((page, i) => [page.id, i]));
  const entries = doc.outline
    .filter((node) => node.destination?.kind === 'page')
    .slice(0, PILL_CONTENTS_MAX);
  return (
    <div id={id} className={styles.contentsList} role="group" aria-label={m.frame_contents()}>
      {entries.map((node, i) => {
        const destination = node.destination;
        if (destination?.kind !== 'page') return null;
        const pageIndex = index.get(destination.page);
        return (
          <EntryRow
            // Outline nodes carry no id; their order is stable while the menu is open.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            key={i}
            onClick={() => {
              const ws = useWorkspaceStore.getState().workspace;
              const page = doc.pages.find((p) => p.id === destination.page);
              const reveal = page ? revealFor(ws, page, destination.view) : undefined;
              closePillMenu();
              useViewStore
                .getState()
                .scrollToPage(destination.page, reveal ? { reveal } : undefined);
              if (pageIndex !== undefined) {
                announce(
                  m.frame_page_announce({ current: pageIndex + 1, total: doc.pages.length }),
                );
              }
              requestAnimationFrame(focusPage);
            }}
          >
            <span className={styles.entryTitle}>{displayTitle(node)}</span>
          </EntryRow>
        );
      })}
    </div>
  );
}

type Fit = 'width' | 'page' | 'none';

/** The layout segments' labels, as F11 §2 draws them; the radios keep the full names. */
const LAYOUT_SHORT: Record<ReadLayout, () => string> = {
  continuous: m.frame_layout_continuous_short,
  single: m.frame_layout_single_short,
  'two-up': m.frame_layout_two_up_short,
};

function ZoomRows() {
  const zoom = useUiStore((s) => s.zoom);
  const fitMode = useUiStore((s) => s.fitMode);
  const layout = useViewStore((s) => s.layout);
  const inShortcut = useCommandShortcut('zoom.in');
  const outShortcut = useCommandShortcut('zoom.out');
  const fit: Fit = fitMode ?? 'none';
  return (
    <section className={styles.section} aria-label={m.frame_zoom()}>
      <div className={styles.zoomRow}>
        <div className={styles.stepper}>
          <IconButton
            label={m.zoom_out()}
            icon={<Icon name="minus" />}
            shortcut={outShortcut}
            tooltipSide="top"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => useUiStore.getState().zoomOut()}
          />
          <span className={styles.zoomValue} aria-live="polite">
            {formatPercent(zoom)}
          </span>
          <IconButton
            label={m.zoom_in()}
            icon={<Icon name="plus" />}
            shortcut={inShortcut}
            tooltipSide="top"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => useUiStore.getState().zoomIn()}
          />
        </div>
        {/* Short labels beside the stepper; the radios keep their full names. */}
        <Segmented<Fit>
          label={m.frame_fit()}
          value={fit}
          frameClassName={styles.fit}
          onValueChange={(value) => {
            if (value === 'width') useUiStore.getState().zoomFit();
            else if (value === 'page') useUiStore.getState().zoomFitPage();
          }}
          options={[
            { value: 'width', label: m.frame_fit_width_short(), name: m.zoom_fit_width() },
            { value: 'page', label: m.frame_fit_page_short(), name: m.zoom_fit_page() },
          ]}
        />
      </div>
      <Segmented<ReadLayout>
        label={m.layout_label()}
        value={layout}
        onValueChange={(value) => setReadLayout(value)}
        options={READ_LAYOUTS.map((value) => ({
          value,
          label: LAYOUT_SHORT[value](),
          name: layoutTitle(value),
        }))}
      />
    </section>
  );
}

function FieldOutlines({ doc }: { readonly doc: VirtualDocument }) {
  const highlight = useFormStore((s) => s.highlight);
  const hasFields = useFormStore((s) =>
    documentSources(doc).some((source) => (s.sources[source]?.fields.length ?? 0) > 0),
  );
  if (!hasFields) return null;
  return (
    <EntryRow
      aria-pressed={highlight}
      onClick={() => void commandRegistry.execute('forms.highlight')}
    >
      <span className={styles.entryTitle}>{m.frame_field_outlines()}</span>
      {highlight ? <Icon name="check" className={styles.check} aria-hidden="true" /> : null}
    </EntryRow>
  );
}

function FocusRow() {
  const shortcut = useCommandShortcut('view.focus');
  return (
    <EntryRow
      data-testid="pill-focus"
      onClick={() => {
        closePillMenu();
        enterFocus();
      }}
    >
      <span className={styles.entryTitle}>{m.frame_focus()}</span>
      {shortcut ? <Keycaps shortcut={shortcut} tone="quiet" /> : null}
    </EntryRow>
  );
}

/**
 * One row of the menu (Contents, Show field outlines, Focus): the menu recipe's M row
 * inside the popover (system-audit-2026-10 §3.6), title leading, a detail, check or keycaps
 * trailing. A row, not an action capsule, so not ui/Button.
 */
function EntryRow({
  children,
  ...rest
}: Omit<ComponentPropsWithRef<'button'>, 'type' | 'className'>) {
  return (
    <button
      type="button"
      // eslint-disable-next-line recto/q9-controls
      className={styles.entry}
      {...rest}
    >
      {children}
    </button>
  );
}
