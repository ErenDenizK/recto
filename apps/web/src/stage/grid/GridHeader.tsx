/**
 * PG2 Grid header (`components/06-navigation.md` PG2; PG6 §2): what the Pages grid shows and
 * how big its cells are, visibly (INV-21), in one band under the top strip.
 *
 *   report.pdf · 12 pages    [ This document │ All open 3 ]          ▪ ───○──── ▣
 *   Sources: report.pdf, agreement.pdf  (a Combine's result, for the session)
 *
 * - **Scope** (`ui/Segmented`, a radio group "Show pages of"): This document · All open, kept
 *   per device. With one document open, All open is dimmed with "Only one document is open".
 *   Switching keeps focus on the control; the sections enter and leave by *reflow*.
 * - **Size** (`ui/Slider`): five detents, Small 96 · Medium 144 · Large 200 · Larger 280 ·
 *   Largest 400 px (`ARRANGE_SIZES`), kept per device; arrows step, Home / End go to the ends,
 *   and "Thumbnail size Large" is announced. The same steps as Mod+wheel and the pinch.
 * - **Material**: the docked frame's band (`glass-frame`), the strip's hairline moved to its
 *   bottom edge; segments and slider are fills inside it, never glass in glass. No light.
 * - **Guard**: none. Scope and size are views, so they work on a locked document too.
 */
import { m } from '../../i18n';
import { announce } from '../../shell/announcer';
import { ARRANGE_SIZES, useUiStore } from '../../state/ui-store';
import { pagesPhrase, useActiveDocument, useWorkspaceStore } from '../../state/workspace-store';
import { Icon } from '../../ui/Icon';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import styles from './GridHeader.module.css';

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

export function GridHeader() {
  const doc = useActiveDocument();
  const documents = useWorkspaceStore((s) => s.workspace.documentOrder.length);
  const scope = useUiStore((s) => s.gridScope);
  const size = useUiStore((s) => s.arrangeSize);
  const sources = useUiStore((s) => (doc ? s.combinedFrom[doc.id] : undefined));
  const setScope = useUiStore((s) => s.setGridScope);
  const setSize = useUiStore((s) => s.setArrangeSize);
  if (!doc) return null;
  const single = documents < 2;
  return (
    <header className={styles.header} data-grid-header="">
      <div className={styles.title}>
        <p className={styles.line}>
          <span className={styles.name} title={doc.title}>
            {doc.title}
          </span>
          <span className={styles.count}>{pagesPhrase(doc.pages.length)}</span>
        </p>
        {sources && sources.length > 0 ? (
          <p className={styles.sources} data-testid="grid-sources">
            {m.grid_sources({ names: sources.join(', ') })}
          </p>
        ) : null}
      </div>
      <Segmented
        label={m.grid_scope_label()}
        value={single ? 'document' : scope}
        onValueChange={(next) => {
          setScope(next);
          announce(
            next === 'all'
              ? m.grid_region_label_all({ count: documents })
              : m.grid_region_label({ title: doc.title }),
          );
        }}
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
      <span className={styles.spacer} />
      <div className={styles.size}>
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
          onValueChange={(next) => {
            const index = Math.round(next);
            if (index === useUiStore.getState().arrangeSize) return;
            setSize(index);
            announce(gridSizeAnnouncement(index));
          }}
        />
        <Icon
          name="squares-four"
          className={styles.large}
          data-end={size === ARRANGE_SIZES.length - 1 ? '' : undefined}
        />
      </div>
    </header>
  );
}
