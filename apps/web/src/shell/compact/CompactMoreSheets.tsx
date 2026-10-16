/**
 * The compact reader's rarely used sheets (ADR-0033 §2.3): Contents (the file's outline), Go
 * to page, Document info and About. They load on demand, outside the compact edition's static
 * closure (phone code audit 2026-10 §4a; the bundle gate, PRC-11): `CompactSheets` prefetches
 * this module once the browser is idle and when ⋯ opens, so a sheet opens at once.
 *
 * The compact edition has no Settings sheet; its settings are Theme (ADR-0022 §2.4, spec
 * D3-7), Reduce motion (language.md §7.6, A-9) and Dim pages (DESIGN.md §3, MOB-17), at the end
 * of About as the full edition's own rows (`settings/ThemeRow.tsx`,
 * `settings/ReduceMotionRow.tsx`, `settings/DimPagesRow.tsx`, the same `appearance-store`
 * fields), so a person who wants light on a dark phone, less motion than their system asks for,
 * or quieter pages at night, can say so on a phone too; and Language, which left the Library's
 * corner for these rows (DSN-46): English · Türkçe, each name in its own language.
 */
import type { OutlineNode, VirtualDocument } from '@pdf-editor/document-model';
import {
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { formatFileSize } from '../../home/home-model';
import {
  chooseLocale,
  formatDay,
  getLocale,
  type Locale,
  LOCALE_NAMES,
  locales,
  m,
  subscribeLocale,
} from '../../i18n';
import { DimPagesRow } from '../../settings/DimPagesRow';
import { ReduceMotionRow } from '../../settings/ReduceMotionRow';
import { ThemeRow } from '../../settings/ThemeRow';
import { Row, Section } from '../../settings/rows';
import { useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Icon } from '../../ui/Icon';
import { Segmented } from '../../ui/Segmented';
import { documentLabels, hasCustomLabels, parseGoTo } from '../../viewer/navigation';
import { BUILD_INFO, LICENSE_ID, PRODUCT_NAME, REPOSITORY_URL } from '../about/build-info';
import { MakerCredit } from '../about/MakerCredit';
import { AppGlyph } from '../AppGlyph';
import { openableUrl } from '../OutlinePanel.tree';
import { useFileInfo } from './CompactChrome';
import { CompactSheet } from './CompactSheet';
import { closeSheet, useCompactStore } from './compact-store';
import controls from './controls.module.css';
import styles from './CompactSheets.module.css';
import { jumpTo } from './jump';

export default function CompactMoreSheets({ doc }: { readonly doc: VirtualDocument }) {
  const sheet = useCompactStore((s) => s.sheet);
  return (
    <>
      <CompactSheet
        open={sheet === 'contents'}
        onClose={closeSheet}
        title={m.compact_contents()}
        size="tall"
        testId="compact-contents-sheet"
      >
        <Contents doc={doc} />
      </CompactSheet>
      <GoToSheet doc={doc} open={sheet === 'goto'} />
      <CompactSheet
        open={sheet === 'info'}
        onClose={closeSheet}
        title={m.compact_info()}
        testId="compact-info-sheet"
      >
        <DocumentInfo doc={doc} />
      </CompactSheet>
      <CompactSheet
        open={sheet === 'about'}
        onClose={closeSheet}
        title={m.about_command({ name: PRODUCT_NAME })}
        testId="compact-about-sheet"
      >
        <About />
      </CompactSheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Contents
// ---------------------------------------------------------------------------

interface ContentsRow {
  readonly key: string;
  readonly node: OutlineNode;
  readonly level: number;
}

/** Every entry of the outline, in reading order, with its depth (a phone shows them all). */
export function flattenContents(nodes: readonly OutlineNode[]): ContentsRow[] {
  const rows: ContentsRow[] = [];
  const visit = (list: readonly OutlineNode[], prefix: string, level: number) => {
    list.forEach((node, index) => {
      const key = prefix === '' ? String(index) : `${prefix}.${index}`;
      rows.push({ key, node, level });
      visit(node.children, key, level + 1);
    });
  };
  visit(nodes, '', 1);
  return rows;
}

function Contents({ doc }: { readonly doc: VirtualDocument }) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const labels = documentLabels(ws, doc);
  const pageIndex = new Map(doc.pages.map((page, index) => [page.id, index]));
  const rows = flattenContents(doc.outline);
  return (
    <ul className={styles.contents} aria-label={m.outline_tree_label({ title: doc.title })}>
      {rows.map(({ key, node, level }) => {
        const destination = node.destination;
        const title = node.title.trim() || m.outline_untitled();
        const indent = { paddingInlineStart: 12 + Math.min(level - 1, 4) * 16 };
        if (destination?.kind === 'page') {
          const index = pageIndex.get(destination.page);
          if (index !== undefined) {
            const top = destination.view?.top;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={styles.contentsRow}
                  style={indent}
                  data-level={level}
                  onClick={() =>
                    // A zero-size region aligns its top under the top bar (CompactReader).
                    jumpTo(
                      doc,
                      index,
                      top === undefined
                        ? undefined
                        : {
                            reveal: { x: destination.view?.left ?? 0, y: top, width: 0, height: 0 },
                          },
                    )
                  }
                >
                  <span className={styles.contentsTitle}>{title}</span>
                  <span className={styles.contentsPage}>{labels[index] ?? index + 1}</span>
                </button>
              </li>
            );
          }
        }
        if (destination?.kind === 'uri') {
          const url = openableUrl(destination.uri);
          if (url) {
            return (
              <li key={key}>
                <a
                  className={styles.contentsRow}
                  style={indent}
                  href={url.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.contentsTitle}>
                    {title}
                    <span className={styles.contentsHint}>
                      {m.compact_contents_external({
                        host: url.protocol === 'mailto:' ? url.pathname : url.host,
                      })}
                    </span>
                  </span>
                  <Icon name="arrow-up-right" className={styles.contentsIcon} />
                </a>
              </li>
            );
          }
        }
        return (
          <li key={key}>
            <span className={styles.contentsRow} style={indent} aria-disabled="true">
              <span className={styles.contentsTitle}>
                {title}
                {destination?.kind === 'unresolved' ? (
                  <span className={styles.contentsHint}>{m.outline_unresolved()}</span>
                ) : null}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Go to page
// ---------------------------------------------------------------------------

function GoToSheet({ doc, open }: { readonly doc: VirtualDocument; readonly open: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <CompactSheet
      open={open}
      onClose={closeSheet}
      title={m.goto_title()}
      testId="compact-goto-sheet"
      initialFocus={inputRef}
    >
      {open ? <GoToForm doc={doc} inputRef={inputRef} /> : null}
    </CompactSheet>
  );
}

function GoToForm({
  doc,
  inputRef,
}: {
  readonly doc: VirtualDocument;
  readonly inputRef: RefObject<HTMLInputElement | null>;
}) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const labels = documentLabels(ws, doc);
  const custom = hasCustomLabels(labels);
  const [value, setValue] = useState('');
  const hintId = useId();
  const target = parseGoTo(value, labels);
  const total = doc.pages.length;
  let hint: string;
  if (target.kind === 'page') {
    const label = labels[target.index] ?? '';
    hint =
      custom && label !== String(target.index + 1)
        ? m.goto_preview_label({ number: target.index + 1, total, label })
        : m.goto_preview({ number: target.index + 1, total });
  } else if (target.kind === 'invalid') hint = m.goto_invalid({ value: value.trim() });
  else {
    hint = custom
      ? m.goto_hint_labels({ first: labels[0] ?? '1', last: labels[labels.length - 1] ?? '' })
      : m.goto_hint({ total });
  }
  const onSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (target.kind === 'page') jumpTo(doc, target.index);
  };
  return (
    <form className={styles.goto} onSubmit={onSubmit}>
      <div className={styles.gotoRow}>
        <input
          ref={inputRef}
          className={styles.gotoInput}
          type="text"
          inputMode={custom ? 'text' : 'numeric'}
          enterKeyHint="go"
          autoComplete="off"
          aria-label={m.goto_label()}
          aria-describedby={hintId}
          aria-invalid={target.kind === 'invalid' || undefined}
          placeholder={String(useViewStore.getState().currentPage + 1)}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" className={controls.primary} disabled={target.kind !== 'page'}>
          {m.goto_go()}
        </button>
      </div>
      <p
        id={hintId}
        className={styles.gotoHint}
        data-invalid={target.kind === 'invalid' || undefined}
      >
        {hint}
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Document info and About
// ---------------------------------------------------------------------------

function DocumentInfo({ doc }: { readonly doc: VirtualDocument }) {
  const file = useFileInfo(doc);
  const locale = getLocale();
  const producer = doc.metadata.producer?.trim();
  return (
    <dl className={styles.facts}>
      <Fact label={m.info_name()} testId="compact-info-name">
        {file?.name ?? doc.title}
      </Fact>
      <Fact label={m.info_pages()} testId="compact-info-pages">
        {doc.pages.length}
      </Fact>
      {file ? (
        <Fact label={m.info_size()} testId="compact-info-size">
          {formatFileSize(file.size, locale)}
        </Fact>
      ) : null}
      {producer ? (
        <Fact label={m.compact_info_producer()} testId="compact-info-producer">
          {producer}
        </Fact>
      ) : null}
    </dl>
  );
}

function Fact({
  label,
  testId,
  children,
}: {
  readonly label: string;
  readonly testId: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue} data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

function About() {
  const date = new Date(BUILD_INFO.buildDate);
  const built = Number.isNaN(date.getTime())
    ? BUILD_INFO.buildDate
    : formatDay(date, { year: true });
  return (
    <div className={styles.about}>
      <div className={styles.aboutHead}>
        <AppGlyph size={28} />
        <div>
          <p className={styles.aboutName}>{PRODUCT_NAME}</p>
          {BUILD_INFO.isPreRelease ? (
            <p className={styles.aboutBadge}>{m.about_public_beta()}</p>
          ) : null}
        </div>
      </div>
      <p className={styles.aboutStatement}>{m.about_files_local()}</p>
      <dl className={styles.facts}>
        <Fact label={m.about_version()} testId="compact-about-version">
          {BUILD_INFO.version}
        </Fact>
        <Fact label={m.about_build_date()} testId="compact-about-date">
          {built}
        </Fact>
        <Fact label={m.about_license()} testId="compact-about-license">
          {LICENSE_ID}
        </Fact>
      </dl>
      <div className={styles.links}>
        <a
          className={styles.link}
          href={BUILD_INFO.releaseNotesUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span>{m.about_release_notes()}</span>
          <Icon name="arrow-up-right" />
          <span className="visually-hidden"> {m.about_new_tab()}</span>
        </a>
        <a className={styles.link} href={REPOSITORY_URL} target="_blank" rel="noreferrer">
          <span>{m.about_source()}</span>
          <Icon name="arrow-up-right" />
          <span className="visually-hidden"> {m.about_new_tab()}</span>
        </a>
      </div>
      <div className={styles.aboutSettings}>
        <Section title={m.appearance_heading()}>
          <ThemeRow />
          <ReduceMotionRow />
          <DimPagesRow />
        </Section>
        <Section title={m.settings_section_language()}>
          <LanguageRow />
        </Section>
      </div>
      <MakerCredit className={styles.aboutCredit} />
    </div>
  );
}

/**
 * Language on a phone (DSN-46): English · Türkçe, each name in its own language, applied at
 * once; the browser's language is the default until one is chosen.
 */
function LanguageRow() {
  const current = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  return (
    <Row id="language" bar>
      <Segmented<Locale>
        label={m.settings_section_language()}
        value={current}
        onValueChange={(next) => {
          if (next !== current) chooseLocale(next);
        }}
        options={locales.map((locale) => ({ value: locale, label: LOCALE_NAMES[locale] }))}
      />
    </Row>
  );
}
