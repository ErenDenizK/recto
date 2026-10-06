/**
 * The signature status word with a shield glyph (spec recognize-and-compare §3.4): the title
 * menu's facts row for a signed document (`signatureFact`, which opens S9 Signatures; spec
 * D2-9 moved it there from the status bar and the inspector) and a glyph in each signed
 * document's tab. When a signed source carries edits the row adds that export removes the
 * signatures (ADR-0013; no incremental output).
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { m } from '../i18n';
import { StatusGlyph } from './SignaturesSection';
import styles from './Signatures.module.css';
import { statusLabel, type StatusTone, statusTone } from './status';
import { type DocumentSignatureState, useDocumentSignatureState } from './use-signatures';

/** The status word of a document's signatures (the worst one), or the checking state. */
export function badgeText(state: DocumentSignatureState): string | null {
  if (state.sources.length === 0) return null;
  if (state.summary.status !== undefined) return statusLabel(state.summary.status);
  if (state.checking) return m.signature_checking();
  if (state.failed) return statusLabel('cannot-check');
  return null;
}

/** What the title menu's facts row says about a document's signatures, or null if unsigned. */
export interface SignatureFact {
  /** "Intact, changed later", or "Checking signatures…". */
  readonly text: string;
  readonly tone: StatusTone | undefined;
  /** A signed source carries edits: export removes the signatures. */
  readonly edited: boolean;
  /** The row's accessible name: "Signatures: Intact, removed on export. Show signatures". */
  readonly label: string;
}

export function useSignatureFact(documentId: DocumentId | undefined): SignatureFact | null {
  const state = useDocumentSignatureState(documentId);
  const text = badgeText(state);
  if (text === null) return null;
  return {
    text,
    tone: state.summary.status ? statusTone(state.summary.status) : undefined,
    edited: state.edited,
    label: `${m.signature_badge_label({ status: text })}${
      state.edited ? `, ${m.signature_badge_edited()}` : ''
    }. ${m.signature_badge_show()}`,
  };
}

/** The status glyph of a fact, toned as the tab's (the word always stands beside it). */
export function SignatureFactGlyph({ tone }: { readonly tone: StatusTone | undefined }) {
  return (
    <span className={`${styles.tabGlyph} ${styles.factGlyph}`} data-tone={tone} aria-hidden="true">
      <StatusGlyph tone={tone} />
    </span>
  );
}

/** A decorative shield in a signed document's tab (the title menu's facts row has the words). */
export function SignatureTabGlyph({ documentId }: { readonly documentId: DocumentId }) {
  const state = useDocumentSignatureState(documentId);
  if (state.sources.length === 0) return null;
  const tone = state.summary.status ? statusTone(state.summary.status) : undefined;
  return (
    <span
      className={styles.tabGlyph}
      data-tone={tone}
      data-testid="tab-signature-glyph"
      data-status={state.summary.status}
      aria-hidden="true"
    >
      <StatusGlyph tone={tone} />
    </span>
  );
}
