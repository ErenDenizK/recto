/**
 * The compact edition's Library (ADR-0033 §2.3, §3; composition DSN-31): the same product as the
 * full Library (`home/Launcher.tsx`), laid out for one hand. Top to bottom:
 *
 * 1. **Identity.** The language switch, then the Recto mark (`BrandMark`, its gradient in both
 *    themes) with the wordmark and the one-line promise, in the upper third. On a phone on its
 *    side the mark and wordmark fold into the header row (visual audit 2026-10 item 6).
 * 2. **What the phone does.** Pen, Highlight, Text and Sign as a quiet row of glyph chips, the
 *    tool names of the edit island (EDN-8), and "Every tool on a computer or tablet." under them.
 *    The sentence they replace (EDN-15, ADR-0033 §3 "Honesty") stays for screen readers, so the
 *    row is read once, as one line, never as a modal.
 * 3. **The sample.** **Try the sample** as a lit card (02-library L10) with a drawing of the
 *    sample's first page: static, so the Library loads no engine before a file is chosen.
 * 4. **Recents**, the full edition's (`files/recents.ts`), as one lit card of rows: newest first,
 *    the open document first as "Reading now" (a tap goes back to it), a row without a kept file
 *    handle reopens through the file dialog ("Open again…"), and Clear forgets them all. Before
 *    the first file the card holds one quiet row in its place, "No files yet".
 * 5. **Open PDF**, the one lime, in a floating glass dock where the reader's capsule stands
 *    (M2, `compact-library-dock` in the coverage registry): in thumb reach, above the home
 *    indicator, with Recents scrolling under it.
 *
 * A file that did not open leaves one line saying why (`role="alert"`), under the sample.
 */
import { useState } from 'react';

import { BrandMark } from '../../brand/BrandMark';
import {
  canReopenRecent,
  clearRecents,
  type RecentEntry,
  useRecentsStore,
} from '../../files/recents';
import { formatFileSize, middleTruncate, relativeTime } from '../../home/home-model';
import { getLocale, LOCALE_NAMES, type Locale, locales, m, setLocale } from '../../i18n';
import { pagesPhrase } from '../../state/workspace-store';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons.generated';
import { announce } from '../announcer';
import { PRODUCT_NAME } from '../about/build-info';
import { isOpenEntry, openRecentEntry, pickAndOpen, trySample } from './compact-actions';
import { useCompactStore } from './compact-store';
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

export function CompactLibrary() {
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
        <LanguageSwitch />
      </header>
      <div className={styles.body}>
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
        <Recents />
      </div>
      <div className={styles.dock}>
        <div className={styles.dockPiece} data-testid="compact-library-dock">
          <button
            type="button"
            className={`${controls.primary} ${styles.open}`}
            aria-busy={opening || undefined}
            disabled={opening}
            onClick={() => void pickAndOpen()}
          >
            <Icon name="folder-open" />
            {opening ? m.compact_opening() : m.compact_open_pdf()}
          </button>
        </div>
      </div>
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

/** The phone's four tools as glyph chips; the full sentence is what a screen reader hears. */
function Tools() {
  return (
    <div className={styles.tools} data-testid="compact-tools">
      <p className="visually-hidden">{m.compact_reading_only()}</p>
      <ul className={styles.chips} aria-hidden="true">
        {TOOLS.map((tool) => (
          <li key={tool.icon} className={styles.chip}>
            <Icon name={tool.icon} />
            {tool.label()}
          </li>
        ))}
      </ul>
      <p className={styles.moreTools} aria-hidden="true">
        {m.compact_library_more_tools()}
      </p>
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
      <SamplePage />
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

/*
 * The sample's first page (`public/sample/`, tools/fixtures/sample-fixture.ts), drawn in its own
 * proportions: the running head, the title and its lime rule, the body with its highlighted
 * sentence, the three numbered steps and the notes column. It is content, so it keeps the
 * page's own white and inks in both themes (ADR-0023 §2.1), as a Library card's thumbnail does.
 */
const INK = '#15171c';
const LIME = '#c8fb3d';
const BODY = [92, 104, 98, 106, 72];
const NOTES = [76, 92, 108, 124, 140, 156, 172, 188, 204, 220, 236, 252];

function SamplePage() {
  return (
    <svg className={styles.samplePage} viewBox="0 0 210 297" aria-hidden="true">
      <rect width="210" height="297" fill="#ffffff" />
      <circle cx="18" cy="16" r="3" fill={LIME} />
      <rect x="25" y="14" width="36" height="4" rx="2" fill={INK} opacity="0.35" />
      <rect x="166" y="14" width="26" height="4" rx="2" fill={INK} opacity="0.35" />
      <rect x="16" y="40" width="118" height="13" rx="2" fill={INK} />
      <rect x="16" y="60" width="16" height="3.5" rx="1.75" fill={LIME} />
      {BODY.map((width, i) => (
        <rect
          key={`b${i}`}
          x="16"
          y={74 + i * 10}
          width={width}
          height="4"
          rx="2"
          fill={INK}
          opacity="0.45"
        />
      ))}
      <rect x="14" y="111" width="96" height="9" rx="1" fill={LIME} opacity="0.85" />
      {[0, 1, 2].map((i) => (
        <g key={`s${i}`}>
          <circle cx="20" cy={142 + i * 14} r="4" fill={LIME} />
          <rect
            x="30"
            y={140 + i * 14}
            width={[74, 70, 84][i]}
            height="4"
            rx="2"
            fill={INK}
            opacity="0.55"
          />
        </g>
      ))}
      <rect x="140" y="40" width="0.8" height="232" fill={INK} opacity="0.18" />
      <rect x="146" y="44" width="20" height="3" rx="1.5" fill={INK} opacity="0.35" />
      {NOTES.map((y) => (
        <rect key={`n${y}`} x="146" y={y} width="48" height="0.8" fill={INK} opacity="0.16" />
      ))}
      <rect x="16" y="280" width="178" height="0.8" fill={INK} opacity="0.16" />
    </svg>
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

function Recents() {
  const entries = useRecentsStore((s) => s.entries);
  const loaded = useRecentsStore((s) => s.loaded);
  const access = useRecentsStore((s) => s.access);
  const note = useRecentsStore((s) => s.note);
  const locale = getLocale();
  // Relative times ("5 minutes ago") are read once per visit.
  const [now] = useState(() => Date.now());
  if (!loaded) return null;
  if (entries.length === 0) return <RecentsPlaceholder />;
  // The open document first, then the rest newest first.
  const ordered = [...entries.filter(isOpenEntry), ...entries.filter((e) => !isOpenEntry(e))];
  return (
    <section className={styles.recents} aria-labelledby="compact-recents-heading">
      <div className={styles.recentsHeader}>
        <h2 id="compact-recents-heading" className={styles.recentsTitle}>
          {m.recents_heading()}
        </h2>
        <ClearButton />
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

/** Recents before the first file: the card in its place, one quiet row of the list's shape. */
function RecentsPlaceholder() {
  return (
    <section
      className={styles.recents}
      aria-labelledby="compact-recents-heading"
      data-testid="compact-recents-empty"
    >
      <div className={styles.recentsHeader}>
        <h2 id="compact-recents-heading" className={styles.recentsTitle}>
          {m.recents_heading()}
        </h2>
      </div>
      <div className={`${styles.recentList} ${styles.emptyCard}`}>
        <div className={styles.emptyRow}>
          <span className={styles.recentGlyph} aria-hidden="true">
            <Icon name="file-text" />
          </span>
          <span className={styles.recentText}>
            <span className={styles.emptyTitle}>{m.compact_recents_empty_title()}</span>
            <span className={styles.emptyLine}>{m.compact_recents_empty()}</span>
          </span>
        </div>
      </div>
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
