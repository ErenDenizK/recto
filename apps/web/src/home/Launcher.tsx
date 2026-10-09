/**
 * The launcher (`02-library` L2, reorganised after the owner's review of 2026-10-08 and on
 * system-audit-2026-10 §3.9; replaces `shell/EmptyState.tsx` and Home's Open files button): the
 * welcome and the Library's open actions, in three tiers that read the same in both variants:
 *
 * 1. **Identity.** Empty, the Recto mark (`BrandMark`, its gradient in both themes) with the
 *    headline and the promise. With documents the mark is the tab's alone (owner feedback
 *    2026-10-09, G3: the Library tab is the home button and always shows it), so the view heads
 *    itself with a large "Library" title and "Nothing leaves this device." under it.
 * 2. **Open.** **Open PDFs…** (the view's one lime, first focus when empty, J1 = 2).
 * 3. **More ways to start.** **Try the sample** (dimmed with its reason offline before the
 *    sample was ever loaded), **Combine files…** and **Batch…**, one group of equal standard
 *    buttons with their glyphs, never loose text links.
 *
 * Both variants hold the actions in **one launcher shape** (§3.9, I-12): a lit capsule piece
 * with every action at the one L size (40 fine, 52 coarse; §3.3), Open PDFs… first and lime,
 * the group after it, and the drop line ending it in body ("or drop files anywhere"; on
 * touch too, iPadOS drags files in). No separate drop well: the whole window is the target,
 * and the piece says so.
 *
 * - **Empty** (no document open): mark, headline and promise on the canvas about a third of
 *   the way down the view, the piece centred under them.
 * - **Row** (documents open): the title, then the piece. In Select mode the lime moves to the
 *   selection bar's Combine, so Open PDFs… turns secondary (one lime per view, principle 3).
 * - **Drag-over** (L9 on the Library): no overlay; the piece lifts 2 px with the e3 shadow and
 *   a dashed accent line; the empty headline becomes "Drop to open 2 files", the row's drop
 *   line says it.
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

  // The one launcher shape (§3.9): the actions, then the drop line, in one lit piece. Empty,
  // the headline above says what a release does, so the line keeps its hint.
  const says = dragging && variant === 'row';
  const piece = (
    <div
      className={`${lit.lit} ${styles.piece}`}
      data-lit="row"
      data-dragging={dragging || undefined}
      data-testid={variant === 'row' ? 'library-launcher' : undefined}
    >
      <div className={styles.actions}>
        {open}
        {more}
      </div>
      <p className={styles.dropLine} aria-live={says ? 'off' : undefined}>
        <Icon name="tray-arrow-down" className={styles.dropIcon} />
        <span>{says ? dropTitle(dragCount) : m.library_drop_hint()}</span>
      </p>
    </div>
  );

  if (variant === 'row') {
    return (
      <div className={styles.rowWrap}>
        <header className={styles.title}>
          <h2 className={styles.titleText}>{m.library_label()}</h2>
          <p className={styles.tagline}>{m.library_line()}</p>
        </header>
        {piece}
      </div>
    );
  }

  return (
    <div
      className={styles.welcome}
      data-dragging={dragging || undefined}
      data-testid="library-launcher"
    >
      <BrandMark size={56} className={styles.glyph} />
      <h1 className={styles.headline}>{dragging ? dropTitle(dragCount) : m.library_headline()}</h1>
      <p className={styles.line}>{m.library_line()}</p>
      {piece}
    </div>
  );
}
