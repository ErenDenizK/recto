/**
 * The phone's single capsule (EDN-24, Labs `phone-capsule`, `?phonebar=1`; `phone-capsule-flag.ts`):
 * the bottom chrome as one capsule that morphs between its two contents, the host on the static
 * compact path. `CompactChrome`'s `CompactCapsule` hands over to it on the one branch; with the
 * switch off none of it renders.
 *
 * - **Reading:** Pages (icon), "3 / 12" (the same button as the shipped capsule: the strip's
 *   hold and Go to page), Find (icon), a hairline and ✎ (`compact-capsule-edit`: its own id, so
 *   `capsule-liquid` never takes it for the shipped ✎ beside the capsule).
 * - **Editing:** the mark chunk's `CapsuleTools` in the nav, its `CapsuleTray` in the tray slot
 *   and its `RedoChip` in the chip slot (EDN-21: they load on intent, with the chunk). The three
 *   stand in one column above the home indicator, the chip over Undo, the tray over the capsule.
 *   On a phone on its side the capsule rests right of centre and the tray opens beside it, so
 *   nothing moves when the tray toggles (`PhoneCapsule.module.css`).
 * - **Morph:** the box before the swap (`takeCapsuleSnapshot`) to the box after, `morphCapsule`
 *   (transform only, MOT-14). Focus goes to the Pen on entering editing and back to ✎ on Done.
 * - The nav keeps `data-testid="compact-capsule"` and the `chrome.capsule` class: the selection
 *   bar, the keyboard band, the coverage entry and the hide-on-scroll spring all find it there.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import { m } from '../../i18n';
import { useViewStore } from '../../state/view-store';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import {
  consumeStripClick,
  holdForStrip,
  keyForStrip,
  stripEnabled,
  stripPreview,
} from '../frame/strip/strip-hold';
import chrome from './CompactChrome.module.css';
import { capsuleAway, openFind, openSheet, useCompactStore } from './compact-store';
import {
  prepareEditing,
  startEditing,
  takeCapsuleSnapshot,
  useLoadFieldsForForms,
  useMark,
} from './mark-host';
import { openOverview } from './overview-host';
import styles from './PhoneCapsule.module.css';
import { SelectionHost } from './selection-host';

export function PhoneCapsule({ doc }: { readonly doc: VirtualDocument }) {
  const away = useCompactStore(capsuleAway);
  const editing = useCompactStore((s) => s.editing);
  const mark = useMark();
  const island = editing && mark !== null;
  const capsuleRef = useRef<HTMLElement>(null);
  const wasIsland = useRef(false);
  useLoadFieldsForForms(doc);
  useLayoutEffect(() => {
    const from = takeCapsuleSnapshot();
    const el = capsuleRef.current;
    if (from && el && mark) mark.morphCapsule(el, from);
    // The pressed control went with the old content: focus follows to the new one's start.
    if (wasIsland.current !== island && el) {
      const active = document.activeElement;
      if (active === null || active === document.body || el.contains(active)) {
        el.querySelector<HTMLElement>(
          island ? '[data-capsule-focus]' : '[data-testid="compact-capsule-edit"]',
        )?.focus({ preventScroll: true });
      }
    }
    wasIsland.current = island;
  }, [island, mark]);
  return (
    <>
      <div className={styles.dock} data-editing={island || undefined}>
        <div className={styles.chip}>{island && !away ? <mark.RedoChip /> : null}</div>
        <div className={styles.tray}>{island ? <mark.CapsuleTray /> : null}</div>
        <nav
          ref={capsuleRef}
          className={`${chrome.capsule} ${styles.bar}`}
          aria-label={island ? m.compact_edit_tools() : m.compact_reading_tools()}
          data-hidden={away || undefined}
          data-editing={island || undefined}
          data-compact-chrome=""
          data-testid="compact-capsule"
          data-gpu-glass="capsule"
          inert={away}
        >
          {island ? <mark.CapsuleTools /> : <ReadingTools doc={doc} />}
        </nav>
      </div>
      {island ? <mark.SignHost /> : null}
      {/* The selection bar's watch, as in the shipped capsule. */}
      <SelectionHost />
    </>
  );
}

/** The reading content: Pages, "3 / 12" (Go to page), Find, a hairline and ✎. */
function ReadingTools({ doc }: { readonly doc: VirtualDocument }) {
  const current = useViewStore((s) => s.currentPage);
  const total = doc.pages.length;
  // While the page strip's rail scrubs (DSN-63), the number is the page under the thumb.
  const scrub = useSyncExternalStore(stripPreview.subscribe, stripPreview.get);
  return (
    <>
      <IconButton
        label={m.compact_pages()}
        tooltipSide="top"
        icon={<Icon name="squares-four" />}
        className={styles.icon}
        onClick={openOverview}
      />
      <Button
        variant="quiet"
        className={styles.page}
        data-digits={String(total).length}
        aria-label={m.compact_page_button({ current: current + 1, total })}
        data-testid="compact-page-number"
        data-strip={stripEnabled() ? '' : undefined}
        onPointerDown={(e) => holdForStrip(e, 'y')}
        onKeyDown={(e) => keyForStrip(e, 'y')}
        onClick={() => {
          if (!consumeStripClick()) openSheet('goto');
        }}
      >
        {(scrub ?? current) + 1} / {total}
      </Button>
      <IconButton
        label={m.compact_find()}
        tooltipSide="top"
        icon={<Icon name="magnifying-glass" />}
        className={styles.icon}
        onClick={openFind}
      />
      <span className={styles.rule} aria-hidden="true" />
      <IconButton
        label={m.compact_edit()}
        tooltipSide="top"
        icon={<Icon name="pencil-simple" />}
        className={styles.icon}
        data-testid="compact-capsule-edit"
        onPointerDown={prepareEditing}
        onClick={startEditing}
      />
    </>
  );
}
