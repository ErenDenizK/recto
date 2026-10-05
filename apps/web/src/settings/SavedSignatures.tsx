/**
 * Settings → Saved signatures (components/07-sheets.md S3 §2, §6, 07.8; 03-markup.md MK-12;
 * ADR-0032 §2 item 10; spec redesign D0-11): the row in Documents and storage ("2 of 5") and the
 * page it pushes.
 *
 * - **The list**, newest first: each signature's plate, its name ("Signature, added 3 Oct"
 *   when it has none) and the day it was kept, with Rename and Remove. Rename turns the name
 *   into a field in place: Enter or leaving it keeps the name, Esc keeps the old one.
 * - **Remove** takes it off at once with a toast, "Removed a saved signature · Undo" (10 s,
 *   MK-12 §5); Undo puts it back in its place.
 * - **Add…** opens New signature to keep one (`keep`), which comes back here when it closes.
 * - **Remove all…** asks once (S1, a danger action that cannot be undone) and deletes every
 *   saved signature on this device: final, as the confirmation says. Signatures placed in
 *   documents stay; they are written into the document, not read from here.
 * - Where this window keeps nothing (IndexedDB refused), the page says so and offers nothing.
 */
import { Pencil, Trash2 } from 'lucide-react';
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { formatNumber, m, useLocale } from '../i18n';
import { announce } from '../shell/announcer';
import { openNewSignature } from '../signatures/new-signature';
import {
  clearSignatures,
  loadSavedSignatures,
  NAME_MAX,
  removeSignature,
  renameSignature,
  restoreSignature,
  SAVED_SIGNATURE_LIMIT,
  type SavedSignature,
  signatureDate,
  signatureLabel,
  useSavedSignatures,
} from '../signatures/saved-signatures';
import { SignaturePlate } from '../signatures/SignaturePlate';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { confirm } from '../ui/sheet';
import { TextField } from '../ui/TextField';
import { toast } from '../ui/Toast';
import { NavRow, Section } from './rows';
import type { SettingsPageId } from './search-index';
import styles from './Settings.module.css';
import own from './SavedSignatures.module.css';

/** The row in Documents and storage: how many are kept, and the page it pushes. */
export function SavedSignaturesRow({
  onPush,
  hint,
}: {
  readonly onPush: (page: SettingsPageId) => void;
  readonly hint?: string | undefined;
}) {
  const status = useSavedSignatures((s) => s.status);
  const count = useSavedSignatures((s) => s.signatures.length);
  useLocale();
  useEffect(() => {
    void loadSavedSignatures();
  }, []);
  const value =
    status === 'refused'
      ? m.signature_not_kept()
      : status === 'loading'
        ? undefined
        : count === 0
          ? m.settings_signatures_none()
          : m.settings_signatures_count({
              count: formatNumber(count),
              limit: formatNumber(SAVED_SIGNATURE_LIMIT),
            });
  return (
    <NavRow
      id="savedSignatures"
      label={m.settings_saved_signatures()}
      value={value}
      hint={hint}
      onPress={() => onPush('signatures')}
    />
  );
}

/** "Removed a saved signature · Undo": Undo puts it back in its place. */
async function remove(signature: SavedSignature): Promise<void> {
  const removed = await removeSignature(signature.id);
  if (!removed) return;
  toast.action(
    m.signature_removed_toast(),
    {
      label: m.cmd_undo(),
      run: () => void restoreSignature(removed),
    },
    { key: `signature-removed:${removed.id}`, testId: 'signature-removed-toast' },
  );
}

export function SavedSignaturesPage() {
  const status = useSavedSignatures((s) => s.status);
  const signatures = useSavedSignatures((s) => s.signatures);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useLocale();
  useEffect(() => {
    void loadSavedSignatures();
  }, []);

  if (status === 'refused') {
    return (
      <div className={styles.page} data-page="signatures">
        <p className={styles.note} role="note">
          <span className={styles.mark} aria-hidden="true" />
          <span>{m.signature_not_kept()}</span>
        </p>
      </div>
    );
  }

  const clearAll = async () => {
    const yes = await confirm({
      title: m.settings_signatures_confirm_title(),
      body: m.settings_signatures_confirm_body(),
      action: m.settings_signatures_remove_all(),
      danger: true,
    });
    if (!yes) return;
    setBusy(true);
    const ok = await clearSignatures();
    setBusy(false);
    setFailed(!ok);
    if (ok) announce(m.settings_signatures_cleared());
    else announce(m.settings_signatures_clear_failed(), { politeness: 'assertive' });
  };

  return (
    <div className={styles.page} data-page="signatures" data-testid="settings-signatures">
      <p className={styles.statement}>{m.settings_signatures_statement()}</p>
      {signatures.length > 0 ? (
        <Section title={null} label={m.settings_saved_signatures()}>
          {signatures.map((signature) => (
            <SignatureRow key={signature.id} signature={signature} />
          ))}
        </Section>
      ) : status === 'ready' ? (
        <p className={styles.empty} data-testid="settings-signatures-empty">
          {m.settings_signatures_empty()}
        </p>
      ) : null}
      {failed ? (
        <p className={styles.note} role="note">
          <span className={styles.mark} aria-hidden="true" />
          <span>{m.settings_signatures_clear_failed()}</span>
        </p>
      ) : null}
      <div className={styles.actions} data-bar="settings-row">
        <span>
          {m.settings_signatures_count({
            count: formatNumber(signatures.length),
            limit: formatNumber(SAVED_SIGNATURE_LIMIT),
          })}
        </span>
        <span className={own.buttons}>
          <Button
            variant="standard"
            onClick={() => openNewSignature('keep')}
            data-testid="settings-signatures-add"
          >
            {m.settings_signatures_add()}
          </Button>
          <Button
            variant="danger"
            busy={busy}
            disabled={signatures.length === 0}
            onClick={() => void clearAll()}
            data-testid="settings-signatures-clear"
          >
            {m.settings_signatures_clear_all()}
          </Button>
        </span>
      </div>
    </div>
  );
}

function SignatureRow({ signature }: { readonly signature: SavedSignature }) {
  const [editing, setEditing] = useState(false);
  const label = signatureLabel(signature);
  return (
    <div className={`${styles.row} ${own.row}`} data-row={`signature:${signature.id}`}>
      <div className={styles.line} data-bar="settings-row">
        <SignaturePlate ink={signature} size="row" />
        {editing ? (
          <RenameField signature={signature} onDone={() => setEditing(false)} />
        ) : (
          <span className={own.text}>
            <span className={styles.label} title={label}>
              {label}
            </span>
            <span className={styles.hint}>
              {m.settings_signature_added({ date: signatureDate(signature) })}
            </span>
          </span>
        )}
        {editing ? null : (
          <>
            <IconButton
              size="row"
              label={m.settings_signature_rename({ name: label })}
              tooltip={m.settings_signature_rename({ name: label })}
              icon={<Pencil />}
              onClick={() => setEditing(true)}
            />
            <IconButton
              size="row"
              label={m.settings_signature_remove({ name: label })}
              tooltip={m.settings_signature_remove({ name: label })}
              icon={<Trash2 />}
              onClick={() => void remove(signature)}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** The name in place: Enter or leaving keeps it, Esc keeps the old one. */
function RenameField({
  signature,
  onDone,
}: {
  readonly signature: SavedSignature;
  readonly onDone: () => void;
}) {
  const [value, setValue] = useState(signature.name);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    if (keep && value.trim() !== signature.name) void renameSignature(signature.id, value);
    onDone();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // The sheet's form would submit; the field keeps the name instead.
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      // Esc puts the old name back and leaves the sheet open.
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    }
  };
  return (
    <TextField
      ref={ref}
      className={own.field}
      label={m.settings_signature_name_field()}
      hideLabel
      placeholder={signatureLabel({ ...signature, name: '' })}
      value={value}
      maxLength={NAME_MAX}
      autoComplete="off"
      onValueChange={setValue}
      onKeyDown={onKeyDown}
      onBlur={() => finish(true)}
    />
  );
}
