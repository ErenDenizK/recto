/**
 * A document's file facts and honesty badges (spec document-tools §3; `components/07-sheets.md`
 * S4 §2): name, files, size, pages, modified, then the engine-reported badges with what Save a
 * copy does about each. Shown at the top of Document info (S4), which took them over from the
 * inspector's Info section (inventory 6.7, INV-13; spec D2-9).
 *
 * The badges' explanations are written out under each badge rather than kept in tooltips, so a
 * touch screen reads them too (inventory 6.7's debt). `SOURCE_BADGES` also marks the Pages
 * grid's section headers (`stage/ArrangeSection.tsx`).
 */
import type { SourceFlags, VirtualDocument } from '@pdf-editor/document-model';

import { formatBytes } from '../files/file-filters';
import { getLocale, m } from '../i18n';
import { documentSources, useWorkspaceStore } from '../state/workspace-store';
import { Badge } from '../ui/Badge';
import styles from './DocumentFacts.module.css';

const dateFormat = (value: number) =>
  new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(value);

/** One honesty badge: an engine fact about a source and what export will do about it. */
export interface SourceBadge {
  readonly flag: keyof SourceFlags;
  readonly label: string;
  readonly explanation: string;
}

/** `label` and `explanation` are getters, so they read the active language on every access. */
function badge(
  flag: keyof SourceFlags,
  label: () => string,
  explanation: () => string,
): SourceBadge {
  return {
    flag,
    get label() {
      return label();
    },
    get explanation() {
      return explanation();
    },
  };
}

export const SOURCE_BADGES: readonly SourceBadge[] = [
  badge('encrypted', m.badge_encrypted, m.badge_encrypted_explanation),
  badge('repaired', m.badge_repaired, m.badge_repaired_explanation),
  badge('hasAcroForm', m.badge_form, m.badge_form_explanation),
  badge('hasXfa', m.badge_xfa, m.badge_xfa_explanation),
  badge('hasSignatures', m.badge_signed, m.signature_badge_explanation),
  badge('tagged', m.badge_tagged, m.badge_tagged_explanation),
];

/** The facts as a description list (S4 §8), then the badges with their explanations. */
export function DocumentFacts({ doc }: { readonly doc: VirtualDocument }) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const files = useWorkspaceStore((s) => s.files);
  const sources = documentSources(doc);
  const first = sources[0];
  const file = first === undefined ? undefined : files[first];
  const name = file?.name ?? (first === undefined ? doc.title : ws.sources[first]?.name);
  const size = sources.reduce((sum, id) => sum + (ws.sources[id]?.byteLength ?? 0), 0);
  const badges = SOURCE_BADGES.filter((badge) =>
    sources.some((id) => ws.sources[id]?.flags[badge.flag] === true),
  );
  return (
    <div className={styles.facts} data-testid="document-facts">
      <dl className={styles.grid}>
        <dt>{m.info_name()}</dt>
        <dd title={name}>{name}</dd>
        {sources.length > 1 ? (
          <>
            <dt>{m.info_files()}</dt>
            <dd className={styles.numeric}>{sources.length}</dd>
          </>
        ) : null}
        <dt>{m.info_size()}</dt>
        <dd className={styles.numeric}>{formatBytes(size)}</dd>
        <dt>{m.info_pages()}</dt>
        <dd className={styles.numeric}>{doc.pages.length}</dd>
        <dt>{m.info_modified()}</dt>
        <dd className={styles.numeric}>
          {file && file.lastModified > 0 ? dateFormat(file.lastModified) : '—'}
        </dd>
      </dl>
      {badges.length > 0 ? (
        <ul className={styles.badges} aria-label={m.info_notes()}>
          {badges.map((badge) => (
            <li key={badge.flag} className={styles.badgeRow}>
              <Badge kind="label">{badge.label}</Badge>
              <span className={styles.explanation}>{badge.explanation}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
