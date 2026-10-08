/**
 * The Pages grid's own controls as floating pieces (`components/06-navigation.md` PG2, PG6 §2;
 * owner feedback 2026-10-08, F1: "no stacked bars"). The grid has no header band of its own:
 *
 *   - the document's name and page count are the title in the strip's selected tab
 *     (`DocumentTabs`), with a Combine's sources after the tabs (`GridSources`);
 *   - **Scope** (This document · All open) floats at the bottom-leading corner and **Size** at
 *     the bottom-trailing one, each a small glass piece on the capsule's baseline (the slot the
 *     page pill takes in the reader, `DockBand`), the capsule's height, centred on its line.
 *
 * - **Scope** (`ui/Segmented`, a radio group "Show pages of"): kept per device. With one
 *   document open, All open is dimmed with "Only one document is open". The sections enter and
 *   leave by reflow.
 * - **Size** (`ui/Slider`): five detents, Small 96 · Medium 144 · Large 200 · Larger 280 ·
 *   Largest 400 px (`ARRANGE_SIZES`), kept per device; arrows step, Home / End go to the ends,
 *   and "Thumbnail size Large" is announced. The same steps as Mod+wheel and the pinch.
 * - **Giving way** (F1: nothing overlaps the capsule): each piece keeps 12 px from the capsule
 *   (the page pill's clearance, spec 01.6). Where its full form would come closer, it folds to a
 *   circle of the bar's height: Scope to a toggle "All open", Size to a button named with the
 *   size ("Thumbnail size Large") whose popover holds the slider. Where even a circle would
 *   touch the capsule (a wide selection bar in a narrow window), both rise 8 px above the
 *   capsule, as the pill does. The full forms' widths are measured once they render, so the
 *   choice never oscillates while the capsule morphs.
 * - **Material**: M2 (`mat mat-bar s8 c10`, coverage registry `grid-piece`): the capsule's
 *   tier, σ 8 so the 44 px circle meets the coverage rule; segments and slider are fills
 *   inside, never glass in glass. Both count as one surface of Q-11's budget
 *   (`data-glass-group`): together they are smaller than the header band they replace.
 * - **Guard**: none. Scope and size are views, so they work on a locked document too.
 */
import { Popover } from '@base-ui/react/popover';
import { useLayoutEffect, useRef, useState } from 'react';

import { m } from '../../i18n';
import { announce } from '../../shell/announcer';
import { ARRANGE_SIZES, useUiStore } from '../../state/ui-store';
import { useActiveDocument, useWorkspaceStore } from '../../state/workspace-store';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { PopoverHeader, PopoverPopup } from '../../ui/Popover';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import styles from './GridPieces.module.css';

/** The name of cell size `index` (PG2 §5): Small, Medium, Large, Larger, Largest. */
export function gridSizeName(index: number): string {
  const names = [
    m.grid_size_small,
    m.grid_size_medium,
    m.grid_size_large,
    m.grid_size_larger,
    m.grid_size_largest,
  ];
  return (names[index] ?? m.grid_size_medium)();
}

/** "Thumbnail size Large": said when the size changes, from here, Mod+wheel or a pinch. */
export function gridSizeAnnouncement(index: number): string {
  return m.grid_size_announce({ name: gridSizeName(index) });
}

const DETENTS = ARRANGE_SIZES.map((_, i) => i);

/** Room a piece keeps from the capsule (the page pill's, spec 01.6). */
export const PIECE_CLEARANCE = 12;

/** How the two pieces sit beside a capsule (pure, for the tests). */
export interface PieceFit {
  readonly scopeCompact: boolean;
  readonly sizeCompact: boolean;
  readonly raised: boolean;
}

/**
 * Which forms fit: `lead` and `trail` are the room between the band's inset edges and the
 * capsule on each side, `scope` and `size` the full forms' widths, `circle` a folded piece's.
 */
export function fitPieces(
  lead: number,
  trail: number,
  scope: number,
  size: number,
  circle: number,
): PieceFit {
  const room = (side: number) => side - PIECE_CLEARANCE;
  return {
    scopeCompact: room(lead) < scope,
    sizeCompact: room(trail) < size,
    raised: room(lead) < circle || room(trail) < circle,
  };
}

/** "Sources: report.pdf, agreement.pdf" after the tabs, for a Combine's result (PG6). */
export function GridSources() {
  const doc = useActiveDocument();
  const sources = useUiStore((s) => (doc ? s.combinedFrom[doc.id] : undefined));
  if (!sources || sources.length === 0) return null;
  const text = m.grid_sources({ names: sources.join(', ') });
  return (
    <span data-testid="grid-sources" title={text}>
      {text}
    </span>
  );
}

function setScopeAnnounced(next: 'document' | 'all', documents: number, title: string): void {
  useUiStore.getState().setGridScope(next);
  announce(
    next === 'all' ? m.grid_region_label_all({ count: documents }) : m.grid_region_label({ title }),
  );
}

function sizeChanged(next: number): void {
  const index = Math.round(next);
  if (index === useUiStore.getState().arrangeSize) return;
  useUiStore.getState().setArrangeSize(index);
  announce(gridSizeAnnouncement(index));
}

function SizeSlider({ className }: { readonly className?: string | undefined }) {
  const size = useUiStore((s) => s.arrangeSize);
  return (
    <div className={[styles.size, className].filter(Boolean).join(' ')}>
      <Icon name="squares-four" className={styles.small} data-end={size === 0 ? '' : undefined} />
      <Slider
        className={styles.slider}
        label={m.grid_size_label()}
        value={size}
        min={0}
        max={ARRANGE_SIZES.length - 1}
        step={1}
        detents={DETENTS}
        bubble="never"
        format={gridSizeName}
        onValueChange={sizeChanged}
      />
      <Icon
        name="squares-four"
        className={styles.large}
        data-end={size === ARRANGE_SIZES.length - 1 ? '' : undefined}
      />
    </div>
  );
}

/** The two pieces, mounted in the dock band while the grid shows. */
export function GridPieces() {
  const doc = useActiveDocument();
  const documents = useWorkspaceStore((s) => s.workspace.documentOrder.length);
  const scope = useUiStore((s) => s.gridScope);
  const arrangeSize = useUiStore((s) => s.arrangeSize);
  const leadRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const full = useRef({ scope: 0, size: 0 });
  const [fit, setFit] = useState<PieceFit>({
    scopeCompact: false,
    sizeCompact: false,
    raised: false,
  });

  useLayoutEffect(() => {
    const lead = leadRef.current;
    const trail = trailRef.current;
    const band = lead?.parentElement;
    if (!lead || !trail || !band) return;
    const measure = () => {
      // The full forms' widths, read while they show (fixed per density and language).
      if (!lead.hasAttribute('data-compact')) full.current.scope = lead.offsetWidth;
      if (!trail.hasAttribute('data-compact')) full.current.size = trail.offsetWidth;
      const capsule = band.querySelector<HTMLElement>('[data-region="toolbar"]');
      const box = band.getBoundingClientRect();
      const inset = lead.offsetLeft;
      const cap = capsule?.getBoundingClientRect();
      const leadRoom = cap ? cap.left - box.left - inset : box.width;
      const trailRoom = cap ? box.right - cap.right - inset : box.width;
      const next = fitPieces(
        leadRoom,
        trailRoom,
        full.current.scope,
        full.current.size,
        lead.offsetHeight,
      );
      if (cap) band.style.setProperty('--capsule-h', `${Math.round(cap.height)}px`);
      setFit((previous) =>
        previous.scopeCompact === next.scopeCompact &&
        previous.sizeCompact === next.sizeCompact &&
        previous.raised === next.raised
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(band);
    observer.observe(lead);
    observer.observe(trail);
    const watch = () => {
      const capsule = band.querySelector<HTMLElement>('[data-region="toolbar"]');
      if (capsule) observer.observe(capsule);
    };
    watch();
    const mutation = new MutationObserver(() => {
      watch();
      measure();
    });
    mutation.observe(band, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      mutation.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  if (!doc) return null;
  const single = documents < 2;
  const value = single ? 'document' : scope;
  return (
    <>
      <div
        ref={leadRef}
        className={styles.piece}
        data-grid-piece="scope"
        data-glass-group="grid"
        data-compact={fit.scopeCompact || undefined}
        data-raised={fit.raised || undefined}
      >
        {fit.scopeCompact ? (
          <IconButton
            label={m.grid_scope_all()}
            tooltip={single ? m.grid_scope_all_reason() : m.grid_scope_all()}
            tooltipSide="top"
            icon={<Icon name={value === 'all' ? 'files' : 'file'} />}
            aria-pressed={value === 'all'}
            disabled={single}
            onClick={() =>
              setScopeAnnounced(value === 'all' ? 'document' : 'all', documents, doc.title)
            }
          />
        ) : (
          <Segmented
            label={m.grid_scope_label()}
            value={value}
            onValueChange={(next) => setScopeAnnounced(next, documents, doc.title)}
            options={[
              { value: 'document', label: m.grid_scope_document() },
              {
                value: 'all',
                label: m.grid_scope_all(),
                count: single ? undefined : documents,
                disabled: single,
                reason: single ? m.grid_scope_all_reason() : undefined,
              },
            ]}
            frameClassName={styles.scope}
          />
        )}
      </div>
      <div
        ref={trailRef}
        className={`${styles.piece} ${styles.trail}`}
        data-grid-piece="size"
        data-glass-group="grid"
        data-compact={fit.sizeCompact || undefined}
        data-raised={fit.raised || undefined}
      >
        {fit.sizeCompact ? (
          <Popover.Root>
            <Popover.Trigger
              render={
                <IconButton
                  label={gridSizeAnnouncement(arrangeSize)}
                  tooltipSide="top"
                  icon={<Icon name="squares-four" />}
                />
              }
            />
            <PopoverPopup side="top" align="end" className={styles.sizePopup}>
              <PopoverHeader title={m.grid_size_label()} />
              <SizeSlider className={styles.sizeInPopup} />
            </PopoverPopup>
          </Popover.Root>
        ) : (
          <SizeSlider />
        )}
      </div>
    </>
  );
}
