/**
 * S8 Sign with certificate (components/07-sheets.md §10; spec recognize-and-compare §3.2,
 * §3.4), a task sheet on the Sheet primitive in the sheet grammar (system-audit-2026-10
 * §3.6.1): a .p12/.pfx file and its password (kept in this tab's memory only), optional
 * reason, location and contact, and an optional visible signature (page and corner).
 *
 * - **The file** is a row: "Certificate", the chosen name (or what to choose) under it, and a
 *   `ui/FileButton` trailing, Choose… then Change…. The browser's own "Choose File · No file
 *   chosen" control never shows (Q-14).
 * - **Check certificate** opens the file in a signature worker of its own (`checkIdentity`) and
 *   shows the signer as a group of value rows before anything is signed, with the honesty line
 *   under it; or the engine's refusal (legacy 3DES with the OpenSSL re-export command, wrong
 *   password, no key) under the password. The signature itself is added when Save a copy
 *   writes the file, over the verified output.
 * - Opened from the title menu (`origin: 'app'`), the checked certificate continues to Save a
 *   copy; opened from Save a copy, the sheet replaces it and returns to it (‹ Back) when it
 *   closes (`sign-store.ts`). Output only: no guard, it works while the document is locked
 *   (07 §1.1 rule 4).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import type { SignerFacts } from '@pdf-editor/engine';
import { useId, useRef, useState } from 'react';

import { openSaveCopy } from '../export/export-store';
import { getLocale, m } from '../i18n';
import { shake } from '../motion';
import { announce } from '../shell/announcer';
import { useWorkspaceStore } from '../state/workspace-store';
import { FileButton } from '../ui/FileButton';
import { Icon } from '../ui/Icon';
import { NumberField } from '../ui/NumberField';
import { Select } from '../ui/Select';
import { Sheet, SheetGroup, SheetRow } from '../ui/sheet';
import { Switch } from '../ui/Switch';
import { TextField } from '../ui/TextField';
import { useRetained } from '../ui/use-retained';
import styles from './CertificateSheet.module.css';
import { SIGNATURE_CORNERS, type SignatureCorner } from './pdf-pass';
import {
  closeSignDialog,
  type SignDialog as SignDialogState,
  setSignDraft,
  useSignStore,
} from './sign-store';
import { checkIdentity, signingFailureText, signingReason } from './signing';

export const CERTIFICATE_SHEET = 'certificate';
export const P12_ACCEPT = '.p12,.pfx,application/x-pkcs12';

const CORNER_LABELS: Readonly<Record<SignatureCorner, () => string>> = {
  'bottom-right': m.sign_corner_bottom_right,
  'bottom-left': m.sign_corner_bottom_left,
  'top-right': m.sign_corner_top_right,
  'top-left': m.sign_corner_top_left,
};

/** One key per opening, so each visit starts from the kept draft, not the last visit's form. */
const openings = new WeakMap<SignDialogState, number>();
let serial = 0;
const openingOf = (dialog: SignDialogState): number => {
  let n = openings.get(dialog);
  if (n === undefined) {
    serial += 1;
    n = serial;
    openings.set(dialog, n);
  }
  return n;
};

/** Mounted once at the app root: the sheet for the document the sign store names. */
export function CertificateSheet() {
  const dialog = useSignStore((s) => s.dialog);
  // The form stays shown while the sheet plays its exit.
  const [shown] = useRetained(dialog);
  if (shown === null) return null;
  return (
    <CertificateForm
      key={openingOf(shown)}
      documentId={shown.documentId}
      origin={shown.origin}
      open={dialog !== null}
    />
  );
}

type Phase =
  | { readonly kind: 'form' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'checked'; readonly signer: SignerFacts }
  | {
      readonly kind: 'refused';
      readonly message: string;
      /** The OpenSSL re-export command, for a legacy (3DES/RC2) file. */
      readonly command?: string;
    };

const dateOnly = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(date);
};

function CertificateForm({
  documentId,
  origin,
  open,
}: {
  readonly documentId: DocumentId;
  readonly origin: SignDialogState['origin'];
  readonly open: boolean;
}) {
  const pageCount = useWorkspaceStore((s) => s.workspace.documents[documentId]?.pages.length ?? 0);
  const existing = useSignStore((s) => s.drafts[documentId]);
  const [file, setFile] = useState<{ name: string; bytes: ArrayBuffer } | null>(() =>
    existing ? { name: existing.fileName, bytes: existing.pkcs12.slice(0) } : null,
  );
  const [password, setPassword] = useState(existing?.password ?? '');
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [contact, setContact] = useState(existing?.contactInfo ?? '');
  const [visible, setVisible] = useState(existing?.visible !== undefined);
  const [page, setPage] = useState((existing?.visible?.pageIndex ?? 0) + 1);
  const [corner, setCorner] = useState<SignatureCorner>(
    existing?.visible?.corner ?? 'bottom-right',
  );
  const [phase, setPhase] = useState<Phase>(() =>
    existing ? { kind: 'checked', signer: existing.signer } : { kind: 'form' },
  );
  const [missingFile, setMissingFile] = useState(false);
  const fileButton = useRef<HTMLButtonElement>(null);
  const ids = useId();
  // A new file or password needs a new check.
  const reset = () => {
    if (phase.kind !== 'form') setPhase({ kind: 'form' });
  };

  const onFile = async (chosen: File | undefined) => {
    if (!chosen) return;
    reset();
    setMissingFile(false);
    setFile({ name: chosen.name, bytes: await chosen.arrayBuffer() });
  };

  const onSubmit = async () => {
    if (phase.kind === 'checking') return;
    if (!file) {
      setMissingFile(true);
      fileButton.current?.focus();
      return;
    }
    if (phase.kind === 'checked') {
      setSignDraft(documentId, {
        pkcs12: file.bytes,
        fileName: file.name,
        password,
        reason,
        location,
        contactInfo: contact,
        ...(visible
          ? {
              visible: {
                pageIndex: Math.min(Math.max(page, 1), Math.max(pageCount, 1)) - 1,
                corner,
              },
            }
          : {}),
        signer: phase.signer,
      });
      closeSignDialog();
      if (origin === 'app') openSaveCopy(documentId);
      return;
    }
    setPhase({ kind: 'checking' });
    try {
      const signer = await checkIdentity(file.bytes, password);
      setPhase({ kind: 'checked', signer });
      announce(signer.commonName ?? signer.subject);
    } catch (error) {
      const legacy = signingReason(error) === 'legacy-pkcs12';
      // The engine chunk is loaded by now (the check ran in its worker proxy).
      const command = legacy
        ? (await import('@pdf-editor/engine')).PKCS12_REEXPORT_COMMAND
        : undefined;
      setPhase({
        kind: 'refused',
        message: signingFailureText(error),
        ...(command ? { command } : {}),
      });
      // A wrong password (or a refused file) shakes the password field; a colour pulse under
      // reduced motion (`shake`, motion-2026-10 forms-compact §6).
      shake(
        document.querySelector<HTMLElement>('[data-testid="sign-dialog"] input[type="password"]')
          ?.parentElement ?? null,
      );
    }
  };

  const fileNote = `${ids}-file`;
  const errorId = `${ids}-error`;
  return (
    <Sheet
      id={CERTIFICATE_SHEET}
      kind="task"
      open={open}
      onClose={(why) => closeSignDialog(why === 'replaced')}
      back={origin === 'export' ? () => closeSignDialog() : undefined}
      title={m.sign_dialog_title()}
      primary={{
        label:
          phase.kind === 'checked'
            ? origin === 'app'
              ? m.sign_continue()
              : m.sign_use()
            : m.sign_check(),
        onPress: () => void onSubmit(),
        busy: phase.kind === 'checking',
        busyLabel: m.sign_checking(),
      }}
      initialFocus={fileButton}
      testId="sign-dialog"
    >
      <p className={styles.intro}>{m.sign_dialog_description()}</p>
      <SheetGroup
        footnote={
          missingFile ? (
            <span className={styles.error} role="alert">
              {m.sign_no_file()}
            </span>
          ) : undefined
        }
      >
        <SheetRow
          title={m.sign_certificate()}
          description={
            <span id={fileNote} className={file ? styles.fileName : undefined}>
              {file ? file.name : m.sign_certificate_hint()}
            </span>
          }
        >
          <FileButton
            ref={fileButton}
            accept={P12_ACCEPT}
            size="sm"
            aria-describedby={fileNote}
            aria-invalid={missingFile || undefined}
            inputTestId="certificate-file"
            onFiles={(files) => void onFile(files[0])}
          >
            {file ? m.export_sign_change() : m.sign_choose_file()}
          </FileButton>
        </SheetRow>
        <SheetRow full>
          <TextField
            type="password"
            label={m.sign_password()}
            autoComplete="off"
            spellCheck={false}
            value={password}
            aria-describedby={phase.kind === 'refused' ? errorId : undefined}
            onValueChange={(next) => {
              reset();
              setPassword(next);
            }}
          />
        </SheetRow>
      </SheetGroup>
      {phase.kind === 'checking' ? (
        <p className={styles.status} role="status">
          {m.sign_checking()}
        </p>
      ) : null}
      {phase.kind === 'refused' ? (
        <div className={styles.refused} id={errorId} data-testid="sign-refused">
          <p className={styles.error} role="alert">
            {phase.message}
          </p>
          {phase.command ? (
            <>
              <span className={styles.commandLabel}>{m.sign_command_label()}</span>
              <code className={styles.command} data-testid="sign-reexport-command">
                {phase.command}
              </code>
            </>
          ) : null}
        </div>
      ) : null}
      {phase.kind === 'checked' ? <SignerPreview signer={phase.signer} /> : null}
      <SheetGroup>
        <SheetRow full>
          <Switch
            label={m.sign_visible()}
            description={m.sign_visible_hint()}
            checked={visible}
            disabled={pageCount === 0}
            onCheckedChange={setVisible}
          />
        </SheetRow>
        {visible ? (
          <>
            <SheetRow title={m.sign_visible_page()}>
              <NumberField
                id={`${ids}-page`}
                label={m.sign_visible_page()}
                min={1}
                max={Math.max(pageCount, 1)}
                value={page}
                onValueChange={(next) => setPage(next ?? 1)}
              />
            </SheetRow>
            <SheetRow title={m.sign_visible_corner()}>
              <Select<SignatureCorner>
                id={`${ids}-corner`}
                label={m.sign_visible_corner()}
                value={corner}
                onValueChange={setCorner}
                options={SIGNATURE_CORNERS.map((value) => ({
                  value,
                  label: CORNER_LABELS[value](),
                }))}
              />
            </SheetRow>
          </>
        ) : null}
      </SheetGroup>
      <SheetGroup label={m.sign_details()}>
        <SheetRow full>
          <TextField label={m.sign_reason()} value={reason} onValueChange={setReason} />
        </SheetRow>
        <SheetRow full>
          <TextField label={m.sign_location()} value={location} onValueChange={setLocation} />
        </SheetRow>
        <SheetRow full>
          <TextField label={m.sign_contact()} value={contact} onValueChange={setContact} />
        </SheetRow>
      </SheetGroup>
    </Sheet>
  );
}

/**
 * The signer read from the file (S8 §2): one row in a solid well, the name at body 500 beside
 * the passed check's glyph, and the issuer, expiry and key under it as a description list that
 * wraps (a distinguished name is long); the honesty line is the group's footnote.
 */
function SignerPreview({ signer }: { readonly signer: SignerFacts }) {
  return (
    <div data-testid="signer-preview" role="status">
      <SheetGroup footnote={m.sign_signer_preview()}>
        <SheetRow full>
          <div className={styles.signer}>
            <Icon name="seal-check" className={styles.signerGlyph} />
            <div className={styles.signerText}>
              <span className={styles.signerName} data-testid="signer-name">
                {signer.commonName ?? signer.subject}
              </span>
              <dl className={styles.facts}>
                <dt>{m.signature_issuer()}</dt>
                <dd>{signer.issuer}</dd>
                <dt>{m.sign_valid_until()}</dt>
                <dd className={styles.numeric}>{dateOnly(signer.notAfter)}</dd>
                <dt>{m.signature_key()}</dt>
                <dd>{signer.publicKey}</dd>
              </dl>
            </div>
          </div>
        </SheetRow>
      </SheetGroup>
    </div>
  );
}
