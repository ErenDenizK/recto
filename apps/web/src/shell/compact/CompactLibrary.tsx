/**
 * The compact edition's Library (ADR-0033 §2.3, §3): the one primary button, **Open PDF**,
 * the Recents, the reading-only line, and the language switch. Nothing else.
 *
 * - The reading-only line ("Reading only on phones for now…") is the Library's own line under
 *   the button, never a modal (ADR-0033 §3 "Honesty").
 * - Recents are the full edition's (`files/recents.ts`): newest first, the open document
 *   first as "Reading now" (a tap goes back to it), a row without a kept file handle reopens
 *   through the file dialog ("Open again…"), and Clear forgets them all.
 * - A file that did not open leaves one line saying why (`role="alert"`).
 */
import { FileText } from 'lucide-react';
import { useState } from 'react';

import {
  canReopenRecent,
  clearRecents,
  type RecentEntry,
  useRecentsStore,
} from '../../files/recents';
import { formatFileSize, middleTruncate, relativeTime } from '../../home/home-model';
import { getLocale, LOCALE_NAMES, type Locale, locales, m, setLocale } from '../../i18n';
import { pagesPhrase } from '../../state/workspace-store';
import { AppGlyph } from '../AppGlyph';
import { announce } from '../announcer';
import { PRODUCT_NAME } from '../about/build-info';
import { isOpenEntry, openRecentEntry, pickAndOpen } from './compact-actions';
import { useCompactStore } from './compact-store';
import controls from './controls.module.css';
import styles from './CompactLibrary.module.css';

/** Characters of a Recents name before the middle is elided (the row also ellipsizes). */
const NAME_LENGTH = 48;

export function CompactLibrary() {
  const opening = useCompactStore((s) => s.opening);
  const openError = useCompactStore((s) => s.openError);
  return (
    <main className={styles.library} data-testid="compact-library">
      <header className={styles.header}>
        <h1 className={styles.brand}>
          <AppGlyph size={20} />
          <span>{PRODUCT_NAME}</span>
        </h1>
        <LanguageSwitch />
      </header>
      <section className={styles.hero}>
        <button
          type="button"
          className={controls.primary}
          aria-busy={opening || undefined}
          disabled={opening}
          onClick={() => void pickAndOpen()}
        >
          {opening ? m.compact_opening() : m.compact_open_pdf()}
        </button>
        <p className={styles.honesty}>{m.compact_reading_only()}</p>
        {openError ? (
          <p className={styles.error} role="alert" data-testid="compact-open-error">
            {openError}
          </p>
        ) : null}
      </section>
      <Recents />
    </main>
  );
}

function LanguageSwitch() {
  const current = getLocale();
  return (
    <fieldset className={styles.language}>
      <legend className="visually-hidden">{m.compact_language()}</legend>
      {locales.map((locale: Locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          className={`${controls.text} ${styles.languageOption}`}
          aria-pressed={locale === current}
          aria-label={LOCALE_NAMES[locale]}
          onClick={() => setLocale(locale)}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </fieldset>
  );
}

function Recents() {
  const entries = useRecentsStore((s) => s.entries);
  const loaded = useRecentsStore((s) => s.loaded);
  const access = useRecentsStore((s) => s.access);
  const note = useRecentsStore((s) => s.note);
  const locale = getLocale();
  // Relative times ("5 minutes ago") are read once per visit.
  const [now] = useState(() => Date.now());
  if (!loaded || entries.length === 0) return null;
  // The open document first, then the rest newest first.
  const ordered = [...entries.filter(isOpenEntry), ...entries.filter((e) => !isOpenEntry(e))];
  return (
    <section className={styles.recents} aria-labelledby="compact-recents-heading">
      <div className={styles.recentsHeader}>
        <h2 id="compact-recents-heading" className={styles.recentsTitle}>
          {m.recents_heading()}
        </h2>
        <button
          type="button"
          className={`${controls.text} ${controls.quiet}`}
          aria-label={m.recents_clear()}
          onClick={() => {
            void clearRecents().then((cleared) => {
              announce(cleared ? m.recents_announce_cleared() : m.recents_clear_failed());
            });
          }}
        >
          {m.compact_recents_clear()}
        </button>
      </div>
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
        onClick={() => void openRecentEntry(entry)}
      >
        <span className={styles.recentGlyph} aria-hidden="true">
          <FileText />
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
