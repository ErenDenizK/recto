/**
 * S5 Password (components/07-sheets.md §7; spec document-tools.md §3, §4): Set password and
 * Remove password as task sheets on the Sheet primitive, in the sheet grammar
 * (system-audit-2026-10 §3.6.1). Each result is one history entry on the document model
 * (`setSecurity`, `removePassword`) and takes effect when the document is saved.
 *
 * - **Set password:** the two passwords as full-width rows, each with its hint and the strength
 *   meter under it (`password-strength.ts`: four segments and the word, never colour alone,
 *   `role="meter"`); Show passwords as a switch that shows both (§7.8); the permissions as
 *   checkboxes under "Allow", with the AES-256 line and the random-owner note as the group's
 *   footnote. The form's problems (`set_password_error_*`) show under the passwords.
 * - **Remove password:** what removing changes (the policy set here, files opened with their
 *   password, files whose restrictions go), and, where restrictions go, the box that confirms
 *   the person may remove them; the primary is the danger label.
 * - Opened from Document info or Save a copy, the sheet returns there when it closes
 *   (`document-store.ts`); from Save a copy it shows ‹ Back.
 * - **Guard** `document` (§7.6): a locked document shows the lock banner and refuses the act.
 */
import {
  type PermissionFlags,
  removePassword,
  setSecurity,
  type VirtualDocument,
  type Workspace,
} from '@pdf-editor/document-model';
import { useId, useState } from 'react';

import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { openTitleMenu } from '../shell/frame/frame-store';
import { useChangeRefusal } from '../state/guard';
import { useWorkspaceStore } from '../state/workspace-store';
import { Checkbox } from '../ui/Checkbox';
import { Sheet, SheetField, SheetGroup, SheetRow } from '../ui/sheet';
import { Switch } from '../ui/Switch';
import { closeDocumentDialog, type DocumentDialog } from './document-store';
import {
  initialValues,
  normalizePermissions,
  type PasswordFormValues,
  toPolicy,
  validatePasswordForm,
} from './password-form';
import { passwordStrength } from './password-strength';
import styles from './PasswordSheet.module.css';
import {
  PERMISSION_KEYS,
  passwordSources,
  permissionLabel,
  restrictedSources,
  restrictionList,
} from './security-text';

export const SET_PASSWORD_SHEET = 'set-password';
export const REMOVE_PASSWORD_SHEET = 'remove-password';

function commit(operation: (ws: Workspace) => Workspace, label: string): boolean {
  return useWorkspaceStore.getState().applyOperation(operation, label);
}

/** The sheet's props that every document-tools sheet shares: open state, return and lock. */
export function useDocumentSheet(doc: VirtualDocument, origin: DocumentDialog['origin']) {
  const refusal = useChangeRefusal(doc.id, 'document');
  return {
    onClose: (reason: string) => closeDocumentDialog(reason === 'replaced'),
    back: origin === 'export' ? () => closeDocumentDialog() : undefined,
    locked:
      refusal?.kind === 'locked'
        ? { name: doc.title, onUnlock: () => openTitleMenu('menu') }
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Set password
// ---------------------------------------------------------------------------

const STRENGTH_LABELS = [
  m.strength_very_weak,
  m.strength_weak,
  m.strength_fair,
  m.strength_good,
  m.strength_strong,
];

/** Four segments and the word (§7.3): n7 empty, n12 filled; the word carries the meaning. */
function StrengthMeter({ value, id }: { readonly value: string; readonly id: string }) {
  if (value === '') return null;
  const { score } = passwordStrength(value);
  const label = (STRENGTH_LABELS[score] ?? m.strength_very_weak)();
  const text = m.strength_label({ strength: label });
  return (
    <span
      className={styles.strength}
      id={id}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={4}
      aria-valuenow={score}
      aria-valuetext={text}
    >
      <span className={styles.strengthBar} aria-hidden="true">
        {[0, 1, 2, 3].map((segment) => (
          <span key={segment} data-on={segment < Math.max(score, 1) || undefined} />
        ))}
      </span>
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

function PasswordInput({
  label,
  hint,
  value,
  shown,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly shown: boolean;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className={styles.password}>
      <SheetField
        id={id}
        label={label}
        showLabel
        type={shown ? 'text' : 'password'}
        autoComplete="new-password"
        spellCheck={false}
        readOnly={disabled}
        value={value}
        aria-describedby={`${id}-hint ${id}-strength`}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <span id={`${id}-hint`} className={styles.hint}>
        {hint}
      </span>
      <StrengthMeter value={value} id={`${id}-strength`} />
    </div>
  );
}

function problemText(problem: NonNullable<ReturnType<typeof validatePasswordForm>['problem']>) {
  switch (problem) {
    case 'no-password':
      return m.set_password_error_none();
    case 'same-passwords':
      return m.set_password_error_same();
    case 'too-long':
      return m.set_password_error_long();
  }
}

export function SetPasswordSheet({
  doc,
  open,
  origin,
}: {
  readonly doc: VirtualDocument;
  readonly open: boolean;
  readonly origin: DocumentDialog['origin'];
}) {
  const sheet = useDocumentSheet(doc, origin);
  const [values, setValues] = useState<PasswordFormValues>(() => initialValues(doc.security));
  const [show, setShow] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const check = validatePasswordForm(values);
  const permissions = normalizePermissions(values.permissions);
  const readOnly = sheet.locked !== undefined;
  const setPermission = (key: keyof PermissionFlags, allowed: boolean) =>
    setValues((v) => ({ ...v, permissions: { ...v.permissions, [key]: allowed } }));
  const onSubmit = () => {
    setSubmitted(true);
    if (check.problem !== undefined) return;
    const policy = toPolicy(values);
    commit((ws) => setSecurity(ws, doc.id, policy), m.history_set_password());
    closeDocumentDialog();
    announce(m.announce_password_set());
  };
  const problem = submitted && check.problem !== undefined ? problemText(check.problem) : null;
  return (
    <Sheet
      id={SET_PASSWORD_SHEET}
      kind="task"
      open={open}
      onClose={sheet.onClose}
      back={sheet.back}
      locked={sheet.locked}
      title={m.set_password_title()}
      primary={{ label: m.set_password_apply(), onPress: onSubmit }}
      testId="set-password-dialog"
    >
      <p className={styles.intro}>{m.set_password_description()}</p>
      <SheetGroup
        footnote={
          problem ? (
            <span className={styles.error} role="alert">
              {problem}
            </span>
          ) : undefined
        }
      >
        <SheetRow full>
          <PasswordInput
            label={m.set_password_user()}
            hint={m.set_password_user_hint()}
            value={values.userPassword}
            shown={show}
            disabled={readOnly}
            onChange={(userPassword) => setValues((v) => ({ ...v, userPassword }))}
          />
        </SheetRow>
        <SheetRow full>
          <PasswordInput
            label={m.set_password_owner()}
            hint={m.set_password_owner_hint()}
            value={values.ownerPassword}
            shown={show}
            disabled={readOnly}
            onChange={(ownerPassword) => setValues((v) => ({ ...v, ownerPassword }))}
          />
        </SheetRow>
        <SheetRow full>
          <Switch label={m.set_password_show()} checked={show} onCheckedChange={setShow} />
        </SheetRow>
      </SheetGroup>
      <SheetGroup
        label={m.set_password_permissions()}
        footnote={
          <>
            {m.set_password_algorithm()}
            {check.randomOwner ? (
              <>
                {' '}
                <span data-testid="random-owner-note">{m.set_password_random_owner()}</span>
              </>
            ) : null}
          </>
        }
      >
        {PERMISSION_KEYS.map((key) => (
          <SheetRow full key={key}>
            <Checkbox
              label={permissionLabel(key)}
              checked={permissions[key]}
              disabled={
                readOnly ||
                (key === 'printHighQuality' && !values.permissions.print) ||
                (key === 'fillForms' && values.permissions.annotate)
              }
              onCheckedChange={(allowed) => setPermission(key, allowed)}
            />
          </SheetRow>
        ))}
      </SheetGroup>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Remove password
// ---------------------------------------------------------------------------

export function RemovePasswordSheet({
  doc,
  open,
  origin,
}: {
  readonly doc: VirtualDocument;
  readonly open: boolean;
  readonly origin: DocumentDialog['origin'];
}) {
  const sheet = useDocumentSheet(doc, origin);
  const ws = useWorkspaceStore((s) => s.workspace);
  const restricted = restrictedSources(ws, doc);
  const locked = passwordSources(ws, doc);
  const [confirmed, setConfirmed] = useState(false);
  const needsConfirmation = restricted.length > 0;
  const onSubmit = () => {
    if (needsConfirmation && !confirmed) return;
    commit((w) => removePassword(w, doc.id), m.history_remove_password());
    closeDocumentDialog();
    announce(m.announce_password_removed());
  };
  const lines = [
    ...(doc.security ? [{ key: 'policy', text: m.remove_password_policy() }] : []),
    ...locked.map((source) => ({
      key: `locked-${source.id}`,
      text: m.remove_password_locked({ name: source.name }),
    })),
    ...restricted.map((source) => ({
      key: `restricted-${source.id}`,
      text: m.remove_password_restricted({
        name: source.name,
        restricted: restrictionList(source.flags.permissions as PermissionFlags),
      }),
    })),
  ];
  return (
    <Sheet
      id={REMOVE_PASSWORD_SHEET}
      kind="task"
      open={open}
      onClose={sheet.onClose}
      back={sheet.back}
      locked={sheet.locked}
      title={m.remove_password_title()}
      description={m.remove_password_description()}
      primary={{
        label: m.remove_password_apply(),
        onPress: onSubmit,
        danger: true,
        disabled: needsConfirmation && !confirmed,
      }}
      initialFocus={needsConfirmation ? undefined : 'primary'}
      testId="remove-password-dialog"
    >
      {lines.length > 0 ? (
        <SheetGroup>
          {lines.map((line) => (
            <SheetRow key={line.key} full>
              <p className={styles.line}>{line.text}</p>
            </SheetRow>
          ))}
        </SheetGroup>
      ) : null}
      {needsConfirmation ? (
        <SheetGroup>
          <SheetRow full>
            <Checkbox
              label={m.remove_password_confirm()}
              checked={confirmed}
              onCheckedChange={setConfirmed}
              className={styles.confirm}
            />
          </SheetRow>
        </SheetGroup>
      ) : null}
    </Sheet>
  );
}
