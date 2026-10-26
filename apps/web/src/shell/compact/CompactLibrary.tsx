/**
 * The compact edition's Library (ADR-0033 §2.3, §3; composition DSN-31): the same product as the
 * full Library (`home/Launcher.tsx`), laid out for one hand. Top to bottom:
 *
 * 1. **Identity.** The Recto mark (`BrandMark`, its gradient in both themes) with the wordmark
 *    and the one-line promise, in the upper third. On a phone on its side the mark and wordmark
 *    fold into the header row (visual audit 2026-10 item 6). No language switch (DSN-46): the
 *    phone follows the browser's language until About's settings rows change it.
 *    **A gear** (DSN-51, amended for R22 brief C-2), a lit glass circle named "Settings" where
 *    the reader's ⋯ stands (top trailing), opens About
 *    with those rows (Theme, Reduce motion, Dim pages, Language), so the settings are one tap
 *    away before a file is open. About is the phone's settings home (DSN-48); the Library
 *    mounts the on-demand sheets without a document to show it (`CompactSheets`), so the
 *    compact closure carries only the button.
 * 2. **What the phone does.** Pen, Highlight, Text and Sign as a quiet row of glyph chips, the
 *    tool names of the edit island (EDN-8), and "Every tool on a computer or tablet." under them
 *    (EDN-15, ADR-0033 §3 "Honesty"). A screen reader hears what is shown, the four names as a
 *    list and the line after it (DSN-51): the hidden sentence that said the same again is gone.
 * 3. **Recents**, the full edition's (`files/recents.ts`), as one lit card of rows: newest first,
 *    the open document first as "Reading now" (a tap goes back to it), a row without a kept file
 *    handle reopens through the file dialog ("Open again…"), and Clear forgets them all.
 * 4. **The sample.** **Try the sample** as a lit card (02-library L10) with a drawing of the
 *    sample's first page (`SampleCover`): static, so the Library loads no engine before a file
 *    is chosen. Before the first file it comes before Recents, whose card then holds one quiet
 *    row, "No files yet" (the order is the stylesheet's, DSN-50).
 * 5. **Open PDF**, the one lime, in a floating glass dock where the reader's capsule stands
 *    (M2, `compact-library-dock` in the coverage registry): in thumb reach, above the home
 *    indicator, with Recents scrolling under it.
 *
 * A file that did not open leaves one line saying why (`role="alert"`), under the sample.
 */
import { lazy, type ReactNode, Suspense, useState } from 'react';

import { BrandMark } from '../../brand/BrandMark';
import {
  canReopenRecent,
  clearRecents,
  type RecentEntry,
  useRecentsStore,
} from '../../files/recents';
import { HOME_CONTINUE_FLAG, homeFlagEnabled } from '../../home/home-flags';
import { formatFileSize, middleTruncate, relativeTime } from '../../home/home-model';
import { getLocale, m } from '../../i18n';
import { SampleCover } from '../../sample/SampleCover';
import { pagesPhrase } from '../../state/workspace-store';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons.generated';
import { announce } from '../announcer';
import { PRODUCT_NAME } from '../about/build-info';
import { CompactSheets, loadMoreSheets } from './CompactSheets';
import { isOpenEntry, openRecentEntry, pickAndOpen, trySample } from './compact-actions';
import { openSheet, useCompactStore } from './compact-store';
import controls from './controls.module.css';
import styles from './CompactLibrary.module.css';
import { presentError } from '../../errors/present';

/** Characters of a Recents name before the middle is elided (the row also ellipsizes). */
const NAME_LENGTH = 48;

/** The phone's tools, as the edit island names them (EDN-8, EDN-15). */
const TOOLS: readonly { readonly icon: IconName; readonly label: () => string }[] = [
  { icon: 'pen', label: m.compact_tool_pen },
  { icon: 'highlighter', label: m.compact_tool_highlight },
  { icon: 'text-aa', label: m.compact_tool_text },
  { icon: 'signature', label: m.compact_tool_sign },
];

/**
 * The Library. Behind `?home=continue` it is `ContinuedLibrary` (DSN-66, EDN-10), a lazy chunk
 * that adds the Continue card and the one-lime swap; without the flag the phone carries none of
 * it, and the plain screen shows meanwhile.
 */
const ContinuedLibrary = lazy(() => import('./ContinuedLibrary'));

export function CompactLibrary() {
  const plain = <LibraryScreen continued={false} slot={null} />;
  if (!homeFlagEnabled(HOME_CONTINUE_FLAG)) return plain;
  return (
    <Suspense fallback={plain}>
      <ContinuedLibrary />
    </Suspense>
  );
}

/** `continued`: while Continue shows it holds the one lime and Open PDF is secondary (DSN-66). */
export function LibraryScreen({
  continued,
  slot,
}: {
  readonly continued: boolean;
  readonly slot: ReactNode;
}) {
  const opening = useCompactStore((s) => s.opening);
  const openError = useCompactStore((s) => s.openError);
  const firstRun = useRecentsStore((s) => s.loaded && s.entries.length === 0);
  return (
    <main
      className={styles.library}
      data-testid="compact-library"
      data-first-run={firstRun || undefined}
    >
      <header className={styles.header}>
        <h1 className={styles.brand}>
          <BrandMark size={64} className={styles.mark} />
          <span className={styles.wordmark}>{PRODUCT_NAME}</span>
        </h1>
      </header>
      <button
        type="button"
        className={styles.more}
        aria-label={m.settings_title()}
        aria-haspopup="dialog"
        data-testid="compact-library-more"
        onPointerDown={() => void loadMoreSheets().catch(() => undefined)}
        onClick={() => openSheet('settings')}
      >
        <Icon name="gear-six" />
      </button>
      <div className={styles.body}>
        {slot}
        <div className={styles.intro}>
          <p className={styles.promise}>{m.compact_library_promise()}</p>
          <Tools />
          <SampleCard disabled={opening} />
          {openError ? (
            <p className={styles.error} role="alert" data-testid="compact-open-error">
              {openError}
            </p>
          ) : null}
        </div>
        <Recents continued={continued} />
      </div>
      <div className={styles.dock}>
        <div className={styles.dockPiece} data-testid="compact-library-dock">
          <button
            type="button"
            className={`${continued ? controls.text : controls.primary} ${styles.open}`}
            aria-busy={opening || undefined}
            disabled={opening}
            onClick={() => void pickAndOpen()}
          >
            <Icon name="folder-open" />
            {opening ? m.compact_opening() : m.compact_open_pdf()}
          </button>
        </div>
      </div>
      <CompactSheets />
    </main>
  );
}

/** The phone's four tools as glyph chips, read as a list, and where the others are. */
function Tools() {
  return (
    <div className={styles.tools} data-testid="compact-tools">
      <ul className={styles.chips}>
        {TOOLS.map((tool) => (
          <li key={tool.icon} className={styles.chip}>
            <Icon name={tool.icon} />
            {tool.label()}
          </li>
        ))}
      </ul>
      <p className={styles.moreTools}>{m.compact_library_more_tools()}</p>
    </div>
  );
}

/** Try the sample as a card: the first page drawn small, the name and what it is. */
function SampleCard({ disabled }: { readonly disabled: boolean }) {
  return (
    <button
      type="button"
      className={styles.sample}
      disabled={disabled}
      aria-label={m.cmd_try_sample()}
      aria-describedby="compact-sample-line"
      data-testid="compact-sample"
      onClick={() => void trySample()}
    >
      <SampleCover className={styles.samplePage} />
      <span className={styles.sampleText}>
        <span className={styles.sampleTitle}>{m.cmd_try_sample()}</span>
        <span id="compact-sample-line" className={styles.sampleLine}>
          {m.compact_library_sample_line()}
        </span>
      </span>
      <Icon name="caret-right" className={styles.sampleCaret} />
    </button>
  );
}

function ClearButton() {
  return (
    <button
      type="button"
      className={`${controls.text} ${controls.quiet} ${styles.clear}`}
      aria-label={m.recents_clear()}
      onClick={() => {
        void clearRecents().then((cleared) => {
          if (cleared) announce(m.recents_announce_cleared());
          else presentError({ kind: 'message', text: m.recents_clear_failed() });
        });
      }}
    >
      {m.compact_recents_clear()}
    </button>
  );
}

/**
 * Recents as one lit card of rows under the section title and Clear. Before the first file the
 * card holds one quiet row of the list's shape in their place ("No files yet"), under the same
 * title and without Clear: one section, so the two states cannot drift apart.
 */
function Recents({ continued }: { readonly continued: boolean }) {
  const entries = useRecentsStore((s) => s.entries);
  const loaded = useRecentsStore((s) => s.loaded);
  const access = useRecentsStore((s) => s.access);
  const note = useRecentsStore((s) => s.note);
  const locale = getLocale();
  // Relative times ("5 minutes ago") are read once per visit.
  const [now] = useState(() => Date.now());
  if (!loaded) return null;
  const empty = entries.length === 0;
  // The open document first, then the rest newest first; while Continue shows the open one, its
  // "Reading now" row would say it twice (DSN-66).
  const ordered = [
    ...(continued ? [] : entries.filter(isOpenEntry)),
    ...entries.filter((e) => !isOpenEntry(e)),
  ];
  // Nothing else to list: the section would be an empty card under its title.
  if (continued && ordered.length === 0) return null;
  return (
    <section
      className={styles.recents}
      aria-labelledby="compact-recents-heading"
      data-testid={empty ? 'compact-recents-empty' : undefined}
    >
      <div className={styles.recentsHeader}>
        <h2 id="compact-recents-heading" className={styles.recentsTitle}>
          {m.recents_heading()}
        </h2>
        {empty ? null : <ClearButton />}
      </div>
      {empty ? (
        <div className={`${styles.recentList} ${styles.emptyRow}`}>
          <span className={styles.recentGlyph} aria-hidden="true">
            <Icon name="file-text" />
          </span>
          <span className={styles.recentText}>
            <span className={styles.emptyTitle}>{m.compact_recents_empty_title()}</span>
            <span className={styles.emptyLine}>{m.compact_recents_empty()}</span>
          </span>
        </div>
      ) : (
        <ul
          className={styles.recentList}
          aria-label={m.recents_list_label()}
          data-testid="compact-recents"
        >
          {ordered.map((entry) => (
            <RecentRow
              key={entry.id}
              entry={entry}
              reading={isOpenEntry(entry)}
              hint={recentHint(entry, access[entry.id])}
              time={relativeTime(entry.openedAt, now, locale)}
              locale={locale}
            />
          ))}
        </ul>
      )}
      {note ? (
        <p className={styles.note} data-testid="compact-recent-note">
          {note.kind === 'open-again'
            ? m.recents_note_open_again({ name: note.name })
            : m.recents_note_unavailable({ name: note.name })}
        </p>
      ) : null}
    </section>
  );
}

/** What reopening needs, as Home says it: nothing, permission, or the file dialog. */
function recentHint(entry: RecentEntry, access: string | undefined): string | undefined {
  // A kept snapshot reopens by itself on every browser (ADR-0032 §2.6).
  if (entry.kept !== undefined) return entry.kept.changed ? m.recents_hint_kept() : undefined;
  if (!canReopenRecent(entry) || access === 'unavailable') return m.recents_hint_open_again();
  if (access === 'prompt') return m.recents_hint_permission();
  return undefined;
}

function RecentRow({
  entry,
  reading,
  hint,
  time,
  locale,
}: {
  readonly entry: RecentEntry;
  readonly reading: boolean;
  readonly hint: string | undefined;
  readonly time: string;
  readonly locale: string;
}) {
  const details = [
    entry.pages === undefined ? undefined : pagesPhrase(entry.pages),
    formatFileSize(entry.size, locale),
  ]
    .filter(Boolean)
    .join(' · ');
  const status = reading ? m.compact_recent_reading() : hint;
  const label = [entry.name, details, reading ? undefined : time, status]
    .filter(Boolean)
    .join(', ');
  return (
    <li>
      <button
        type="button"
        className={styles.recentRow}
        aria-label={label}
        aria-current={reading || undefined}
        data-reading={reading || undefined}
        // No await before the reopen: a permission prompt needs this tap's activation.
        onClick={(event) => void openRecentEntry(entry, event.currentTarget)}
      >
        <span className={styles.recentGlyph} aria-hidden="true">
          <Icon name="file-text" />
        </span>
        <span className={styles.recentText} aria-hidden="true">
          <span className={styles.recentName}>{middleTruncate(entry.name, NAME_LENGTH)}</span>
          <span className={styles.recentMeta}>
            {[details, reading ? undefined : time].filter(Boolean).join(' · ')}
          </span>
          {status ? (
            <span className={styles.recentStatus} data-reading={reading || undefined}>
              {status}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
