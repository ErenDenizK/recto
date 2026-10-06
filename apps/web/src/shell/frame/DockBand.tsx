/**
 * The dock band (`components/01-frame.md` F1 §2, F10 §2, F11 §2, F13): the overlay slot along
 * the bottom of the free rectangle where the dock rests and the page pill sits at its trailing
 * end. Today's floating tool bar (`shell/FloatingToolbar.tsx`) rests here until the capsule and
 * the dock of D2-2 replace it in place; the Markup palette (D2-3) grows from the same anchor.
 *
 * - **Anchor:** bottom centre of the free rectangle, 16 px up (12 on compact); the band spans
 *   the free rectangle's width, so a docked sidebar moves the dock's centre with the page.
 * - **The pill** rises 8 px above a palette or bar that would come within 12 px of it (spec
 *   01.6); while Markup is open it hides on medium and compact (spec 03.3; Mod+G still works).
 * - **Away:** Focus fades the dock and the pill 8 px down (`--duration-fast`, `--ease-exit`
 *   in; back on `--spring-quick`); hide on scroll moves them out on compact. Either way the
 *   band is `inert`, so focus never lands in it. Each glass surface moves itself: no opacity
 *   or transform on an ancestor of glass (quality-bar Q-3).
 * - Short viewports fold the bar into the compact capsule: the dock and the pill step aside in
 *   viewing there (F1 §6).
 */
import { useLayoutEffect, useRef } from 'react';

import { isMarkupOpen, useStageView, useUiStore } from '../../state/ui-store';
import { useActiveDocument } from '../../state/workspace-store';
import { FloatingToolbar } from '../FloatingToolbar';
import styles from './DockBand.module.css';
import { useFrameStore } from './frame-store';
import { PagePill } from './PagePill';
import { PagePillMenu } from './PagePillMenu';
import type { SizeClass } from './size-class';

/** The pill keeps at least this much room beside a bar before it rises (spec 01.6). */
export const PILL_CLEARANCE = 12;

/** Whether the pill must rise: the bar's trailing edge comes within 12 px of the pill. */
export function pillMustRise(barRight: number, pillLeft: number): boolean {
  return barRight + PILL_CLEARANCE > pillLeft;
}

export function DockBand({
  size,
  compact,
  tight,
}: {
  readonly size: SizeClass;
  /** compact or compact-height: hide on scroll applies. */
  readonly compact: boolean;
  readonly tight: boolean;
}) {
  const view = useStageView();
  const doc = useActiveDocument();
  const markup = useUiStore((s) => isMarkupOpen(s, doc?.id));
  const focus = useFrameStore((s) => s.focusMode);
  const hidden = useFrameStore((s) => s.chromeHidden);
  const bandRef = useRef<HTMLDivElement>(null);
  const away = focus || (compact && hidden);
  const narrow = size === 'compact' || size === 'medium';
  const showDock = view === 'page' && !(tight && !markup);
  const showPill = view === 'page' && (doc?.pages.length ?? 0) > 0 && !(markup && narrow) && !tight;

  // The pill rises above a bar that would touch it.
  useLayoutEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    const measure = () => {
      const bar = band.querySelector<HTMLElement>('[data-region="toolbar"]');
      const pill = band.querySelector<HTMLElement>('[data-region="pill"]');
      if (!pill) return;
      const rise = bar
        ? pillMustRise(
            bar.getBoundingClientRect().right,
            pill.offsetLeft + band.getBoundingClientRect().left,
          )
        : false;
      pill.toggleAttribute('data-raised', rise);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(band);
    const mutation = new MutationObserver(() => {
      for (const el of band.querySelectorAll('[data-region="toolbar"], [data-region="pill"]')) {
        observer.observe(el);
      }
      measure();
    });
    mutation.observe(band, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, []);

  return (
    <div
      ref={bandRef}
      className={styles.band}
      data-frame-layer="band"
      data-away={away || undefined}
      data-hides-on-scroll={compact ? '' : undefined}
      inert={away}
    >
      {showDock ? <FloatingToolbar /> : null}
      {showPill ? <PagePill /> : null}
      {view === 'page' && doc ? <PagePillMenu doc={doc} /> : null}
    </div>
  );
}
