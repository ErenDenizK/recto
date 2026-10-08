/**
 * The launcher (`02-library` L2, reorganised after the owner's review of 2026-10-08; replaces
 * `shell/EmptyState.tsx` and Home's Open files button): the welcome and the Library's open
 * actions, in three tiers that read the same in both variants:
 *
 * 1. **Identity.** The Recto mark (`BrandMark`, the gradient on dark) with the headline (empty)
 *    or, with documents, a calm brand header above the row: mark, "Recto" wordmark and
 *    "Nothing leaves this device.".
 * 2. **Open.** **Open PDFs…** (the view's one lime, first focus when empty, J1 = 2) inside a
 *    dashed *well* that reads as the drop target, beside "or drop files anywhere" (on touch
 *    too: iPadOS drags files in). In the row the well takes the free width. While files are
 *    dragged over the window the well lights in the accent and says what a release does.
 * 3. **More ways to start.** **Try the sample** (dimmed with its reason offline before the
 *    sample was ever loaded), **Combine files…** and **Batch…**, one group of equal standard
 *    buttons with their glyphs, never loose text links.
 *
 * - **Empty** (no document open): a lit card about a third of the way down the view.
 * - **Row** (documents open): the brand header, then one lit row: the well leading, the group
 *   trailing. In Select mode the lime moves to the selection bar's Combine, so Open PDFs… turns
 *   secondary (one lime per view, principle 3).
 * - **Drag-over** (L9 on the Library): no overlay; the card or row lifts 2 px with the e3
 *   shadow, the empty card's headline becomes "Drop to open 2 files" and the row's well says it.
 * - **Busy** (L2 §4): Open PDFs… is busy while the engine reads the picked files, but not while
 *   a password prompt (07-sheets S6) waits for the person: that wait is theirs, not the app's,
 *   and the prompt's own Open shows the busy state once a password is being tried.
 *
 * None of the actions changes an open document (no guard). Open PDFs… carries
 * `data-library-open`, where focus goes after Start fresh and after closing the last card.
 */
import { useEffect, useRef } from 'react';

import { BrandMark } from '../brand/BrandMark';
import { useCommandShortcut } from '../shell/use-command-shortcut';
import { currentPlatform, toAriaKeyShortcut } from '../commands/shortcuts';
import { m } from '../i18n';
import { usePasswordStore } from '../state/password-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { commandRegistry } from '../commands/registry';
import { dropTitle } from './DropOverlay';
import { openSample } from '../sample/open-sample';
import { combineFiles, openPdfs } from './home-actions';
import styles from './Launcher.module.css';
import lit from './lit.module.css';
import { useSampleAvailable } from './use-sample-available';

export interface LauncherProps {
  readonly variant: 'card' | 'row';
  /** A file drag is over the window. */
  readonly dragging: boolean;
  /** Files in that drag, when the browser tells. */
  readonly dragCount: number | undefined;
  /** Select mode: the lime belongs to the selection bar. */
  readonly selecting?: boolean;
}

export function Launcher({ variant, dragging, dragCount, selecting = false }: LauncherProps) {
  // A file waiting on its password still counts as opening; the prompt is what is on screen.
  const opening = useWorkspaceStore((s) => s.opening > 0);
  const prompting = usePasswordStore((s) => s.queue.length > 0);
  const shortcut = useCommandShortcut('file.open');
  const openRef = useRef<HTMLButtonElement>(null);
  const sampleAvailable = useSampleAvailable();

  // First focus on a first visit (J1, L1 §6): Open PDFs…, unless something already has it.
  // Focus placed by the page, not by a key, draws no ring yet (`data-quiet-focus`): a lime ring
  // around the lime button on arrival is noise; the first key press brings the ring back.
  useEffect(() => {
    if (variant !== 'card') return undefined;
    const button = openRef.current;
    const active = document.activeElement;
    if (!button || (active !== null && active !== document.body)) return undefined;
    button.setAttribute('data-quiet-focus', '');
    button.focus({ preventScroll: true });
    const loud = () => button.removeAttribute('data-quiet-focus');
    window.addEventListener('keydown', loud, { capture: true, once: true });
    button.addEventListener('blur', loud, { once: true });
    return () => {
      window.removeEventListener('keydown', loud, { capture: true });
      button.removeEventListener('blur', loud);
    };
  }, [variant]);

  const open = (
    <Button
      ref={openRef}
      variant={selecting ? 'standard' : 'prominent'}
      size="lg"
      icon={<Icon name="folder-open" />}
      busy={opening && !prompting}
      busyLabel={m.library_card_opening()}
      aria-keyshortcuts={shortcut ? toAriaKeyShortcut(shortcut, currentPlatform) : undefined}
      data-library-open=""
      data-testid="library-open"
      onClick={() => void openPdfs()}
    >
      {m.library_open()}
    </Button>
  );
  const sample = (
    <Button
      variant="standard"
      size="lg"
      icon={<Icon name="book-open-text" />}
      disabled={!sampleAvailable}
      reason={m.sample_offline()}
      data-testid="library-sample"
      onClick={() => void openSample()}
    >
      {m.cmd_try_sample()}
    </Button>
  );
  // The secondary actions as one group of equal buttons (owner feedback 2026-10-08: a tidy set,
  // not loose text links), each with the glyph of L2 §5.
  const more = (
    <div className={styles.more} role="group" aria-label={m.library_start_group()}>
      {sample}
      <Button
        variant="standard"
        size="lg"
        icon={<Icon name="stack" />}
        data-testid="library-combine-files"
        onClick={() => void combineFiles()}
      >
        {m.library_combine_files()}
      </Button>
      <Button
        variant="standard"
        size="lg"
        icon={<Icon name="list-checks" />}
        data-testid="library-batch"
        onClick={() => void commandRegistry.execute('document.batch')}
      >
        {m.cmd_batch()}
      </Button>
    </div>
  );

  if (variant === 'row') {
    return (
      <div className={styles.rowWrap}>
        <header className={styles.brand}>
          <BrandMark size={40} className={styles.brandMark} />
          <div className={styles.brandText}>
            <h2 className={styles.wordmark}>{m.frame_brand()}</h2>
            <p className={styles.tagline}>{m.library_line()}</p>
          </div>
        </header>
        <div
          className={`${lit.lit} ${styles.row}`}
          data-lit="row"
          data-dragging={dragging || undefined}
          data-testid="library-launcher"
        >
          <div className={styles.well} data-dragging={dragging || undefined}>
            {open}
            <p className={styles.wellHint} aria-live={dragging ? 'off' : undefined}>
              {dragging ? dropTitle(dragCount) : m.library_drop_hint()}
            </p>
          </div>
          {more}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${lit.lit} ${styles.card}`}
      data-lit=""
      data-dragging={dragging || undefined}
      data-testid="library-launcher"
    >
      <BrandMark size={56} className={styles.glyph} />
      <h1 className={styles.headline}>{dragging ? dropTitle(dragCount) : m.library_headline()}</h1>
      <p className={styles.line}>{m.library_line()}</p>
      <div className={styles.well} data-dragging={dragging || undefined}>
        {open}
        <p className={styles.wellHint}>{m.library_drop_hint()}</p>
      </div>
      {more}
    </div>
  );
}
