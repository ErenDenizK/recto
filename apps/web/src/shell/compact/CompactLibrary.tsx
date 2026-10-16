/**
 * The compact edition's Library (ADR-0033 §2.3, §3; composition DSN-31): the same product as the
 * full Library (`home/Launcher.tsx`), laid out for one hand. Top to bottom:
 *
 * 1. **Identity.** The Recto mark (`BrandMark`, its gradient in both themes) with the wordmark
 *    and the one-line promise, in the upper third. On a phone on its side the mark and wordmark
 *    fold into the header row (visual audit 2026-10 item 6). No language switch (DSN-46): the
 *    phone follows the browser's language, and About's settings rows change it.
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
import { useId, useState } from 'react';

import { BrandMark } from '../../brand/BrandMark';
import {
  canReopenRecent,
  clearRecents,
  type RecentEntry,
  useRecentsStore,
} from '../../files/recents';
import { formatFileSize, middleTruncate, relativeTime } from '../../home/home-model';
import { getLocale, m } from '../../i18n';
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
 * The sample's first page, the phone cut's cover (`public/sample/recto-sample-phone-*.pdf`,
 * tools/fixtures/sample/pages/cover.ts; MOB-11, MOB-14), drawn in its own proportions from
 * the page's coordinates: the night sky over a dark sea, the masthead lit by the lamp, the
 * lime issue line, the beam leaving the lamp by the spine (the aurora ramp, lemon to mint),
 * the lamp's halo, the three cover lines, the dark try slip and the fore-edge lamp tab. It is
 * content, so it keeps the page's own colours in both themes (ADR-0023 §2.1), as a Library
 * card's thumbnail does.
 */
const LIME = '#c8fb3d';
const PAPER = '#f4f5f7';
const SEA = [186, 192, 199, 207, 216, 227, 240, 255, 271];

function SamplePage() {
  const id = useId();
  const ref = (name: string) => `url(#${id}-${name})`;
  return (
    <svg className={styles.samplePage} viewBox="0 0 210 297" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0b0c0e" />
          <stop offset="0.55" stopColor="#0e1014" />
          <stop offset="1" stopColor="#151a21" />
        </linearGradient>
        <radialGradient id={`${id}-dusk`} cx="0" cy="1" r="1" gradientTransform="scale(1 0.4)">
          <stop offset="0" stopColor="#1f9996" stopOpacity="0.3" />
          <stop offset="1" stopColor="#1f9996" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-beam`} x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="#fbffe0" />
          <stop offset="0.3" stopColor="#cbff5f" />
          <stop offset="1" stopColor="#69eaa3" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.12" stopColor="#f6fcc4" />
          <stop offset="0.4" stopColor={LIME} stopOpacity="0.35" />
          <stop offset="1" stopColor={LIME} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-type`} cx="163" cy="158" r="226" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fffff4" />
          <stop offset="0.62" stopColor="#e1e4e8" />
          <stop offset="1" stopColor="#a7adb6" />
        </radialGradient>
      </defs>
      <rect width="210" height="179" fill={ref('sky')} />
      <rect width="210" height="179" fill={ref('dusk')} />
      <rect y="179" width="210" height="118" fill="#07080b" />
      <polygon points="163,158 0,138 0,152" fill={ref('beam')} opacity="0.3" />
      <polygon points="163,158 0,143 0,147" fill={ref('beam')} />
      {SEA.map((y) => (
        <rect key={`s${y}`} x="0" y={y} width="210" height="0.5" fill="#1a1f27" />
      ))}
      <polygon points="138,179 160,172 175,172 210,176 210,181 138,180" fill="#050608" />
      <polygon points="160.5,172 165.5,172 164.5,161 161.5,161" fill="#20262d" />
      <circle cx="163" cy="158" r="16" fill={ref('halo')} />
      <rect x="18" y="16" width="56" height="2.5" rx="1.25" fill={PAPER} opacity="0.4" />
      <rect x="19" y="31" width="171" height="38" rx="3" fill={ref('type')} />
      <rect x="20" y="78" width="60" height="3" rx="1.5" fill={LIME} />
      {[0, 1, 2].map((i) => (
        <g key={`c${i}`}>
          <rect x="20" y={204 + i * 25} width="7" height="8" rx="1" fill={LIME} />
          <rect x="33" y={204 + i * 25} width={[86, 46, 52][i]} height="4" rx="2" fill={PAPER} />
          <rect
            x="33"
            y={211 + i * 25}
            width={[64, 78, 44][i]}
            height="2.5"
            rx="1.25"
            fill={PAPER}
            opacity="0.45"
          />
        </g>
      ))}
      <rect x="20" y="275" width="170" height="10" rx="2" fill="#16181d" />
      <circle cx="25" cy="280" r="1.3" fill={LIME} />
      <rect x="206.8" y="13" width="3.2" height="23" rx="1" fill="#151a21" />
      <rect x="208" y="16" width="0.6" height="17" fill="#edfa6d" />
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
