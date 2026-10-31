/**
 * The desk's intents (DSN-87, `masa.md` §2.2, §2.8): four lit tiles in a 2×2 group, "Ways to
 * start" (Open files…, Sign a PDF…, Combine files…, Scan… where scan is on and a camera
 * exists). Each has a 32 px glyph, a label and a one-line hint. Open files… is the view's one
 * lime while Continue is not showing (ADR-0023, DSN-66), else a standard tile.
 *
 * One tab stop: a roving tabindex, with the arrows moving inside the grid (`gridStep` over the
 * columns the layout shows now), Enter or Space running the tile. Open files… carries
 * `data-library-open` and `library-open`; Combine and Scan keep the launcher's test ids
 * (`library-combine-files`, `library-scan`), so the Library's specs move over with little churn.
 */
import { type CSSProperties, type KeyboardEvent, useId, useRef, useState } from 'react';

import { Menu } from '@base-ui/react/menu';

import { commandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { openScan } from '../scan/scan-flag';
import { useWorkspaceStore } from '../state/workspace-store';
import { Icon, type IconName } from '../ui/Icon';
import { useContinueShown } from './continue-shown';
import { columnsOf } from './desk-model';
import styles from './DeskIntents.module.css';
import { combineFiles, openPdfs } from './home-actions';
import { MoreWaysPopup } from './DeskMoreWays';
import { gridStep } from './home-model';
import lit from './lit.module.css';

interface Intent {
  readonly id: string;
  readonly testId: string;
  readonly icon: IconName;
  readonly label: string;
  readonly hint: string;
  readonly run: () => void;
}

export function DeskIntents({
  scan,
  dragging,
  selecting,
  wide,
}: {
  /** The Scan tile shows (scan is on and a camera exists). */
  readonly scan: boolean;
  /** A file drag is over the window. */
  readonly dragging: boolean;
  /** Select mode: the lime belongs to the selection bar. */
  readonly selecting: boolean;
  /** The hero slot is stacked above or empty: the intents run as one row. */
  readonly wide: boolean;
}) {
  const continued = useContinueShown((s) => s.shown);
  // A file waiting on its password still counts as opening; the prompt is what is on screen.
  const opening = useWorkspaceStore((s) => s.opening > 0);
  const [focused, setFocused] = useState('open');
  const listRef = useRef<HTMLDivElement>(null);
  const base = useId();

  const intents: Intent[] = [
    {
      id: 'open',
      testId: 'library-open',
      icon: 'folder-open',
      label: m.library_open(),
      hint: m.desk_open_hint(),
      run: () => void openPdfs(),
    },
    {
      id: 'sign',
      testId: 'library-sign',
      icon: 'signature',
      label: m.desk_sign(),
      hint: m.desk_sign_hint(),
      run: () => void commandRegistry.execute('file.signPdf'),
    },
    {
      id: 'combine',
      testId: 'library-combine-files',
      icon: 'stack',
      label: m.library_combine_files(),
      hint: m.desk_combine_hint(),
      run: () => void combineFiles(),
    },
    ...(scan
      ? [
          {
            id: 'scan',
            testId: 'library-scan',
            icon: 'scan' as const,
            label: m.scan_button(),
            hint: m.desk_scan_hint(),
            run: openScan,
          },
        ]
      : []),
    ...(scan
      ? []
      : [
          {
            id: 'more',
            testId: 'desk-more',
            icon: 'dots-three' as const,
            label: m.desk_more(),
            hint: m.desk_more_hint(),
            run: () => undefined,
          },
        ]),
  ];
  const tabbable = intents.some((i) => i.id === focused) ? focused : 'open';

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const list = listRef.current;
    if (!list) return;
    const tiles = Array.from(list.querySelectorAll<HTMLElement>('[data-intent]'));
    const index = tiles.findIndex((tile) => tile === event.currentTarget);
    const next = gridStep(index, event.key, tiles.length, columnsOf(tiles));
    if (next === null) return;
    event.preventDefault();
    const target = tiles[next];
    if (target === undefined) return;
    setFocused(target.getAttribute('data-intent') ?? 'open');
    target.focus();
  };

  return (
    <div
      ref={listRef}
      className={styles.group}
      role="group"
      aria-label={m.desk_intents_label()}
      data-count={intents.length}
      data-wide={wide || undefined}
      style={{ '--intents-count': intents.length } as CSSProperties}
      data-dragging={dragging || undefined}
      data-testid="library-launcher"
    >
      {intents.map((intent) => {
        const prominent = intent.id === 'open' && !continued && !selecting;
        const busy = intent.id === 'open' && opening;
        const shared = {
          // A lit tile, as the sample card is, not ui/Button's action capsule: glyph well, label
          // and hint, with its own press (DSN-87).
          className: `${lit.lit} ${styles.tile}`,
          'data-lit': '',
          'data-intent': intent.id,
          'data-prominent': prominent || undefined,
          'data-testid': intent.testId,
          'aria-busy': busy || undefined,
          'aria-labelledby': `${base}-${intent.id}-label`,
          'aria-describedby': `${base}-${intent.id}-hint`,
          tabIndex: intent.id === tabbable ? 0 : -1,
          onFocus: () => setFocused(intent.id),
          onKeyDown,
        };
        const content = (
          <>
            <span className={styles.well} aria-hidden="true">
              <Icon name={intent.icon} className={styles.glyph} />
            </span>
            <span id={`${base}-${intent.id}-label`} className={styles.label}>
              {intent.label}
            </span>
            <span id={`${base}-${intent.id}-hint`} className={styles.hint}>
              {intent.hint}
            </span>
          </>
        );
        if (intent.id === 'more') {
          return (
            <Menu.Root key={intent.id}>
              <Menu.Trigger {...shared}>{content}</Menu.Trigger>
              <MoreWaysPopup />
            </Menu.Root>
          );
        }
        return (
          <button
            key={intent.id}
            type="button"
            {...shared}
            {...(intent.id === 'open' ? { 'data-library-open': '' } : {})}
            onClick={intent.run}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
