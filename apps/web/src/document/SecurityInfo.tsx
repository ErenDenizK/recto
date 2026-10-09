/**
 * Passwords in the Info section (spec document-tools.md §4): the restriction notice for
 * owner-only sources (inline, expandable; this app does not enforce the author's
 * restrictions and says so), what export will do, and the Set / Remove password actions, on
 * the primitives' badge and buttons (quality-bar Q-9), as Document info's Password group
 * (system-audit-2026-10 §3.6.1).
 */
import type { PermissionFlags, VirtualDocument } from '@pdf-editor/document-model';

import { m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SheetGroup, SheetRow } from '../ui/sheet';
import { openDocumentDialog } from './document-store';
import layout from './DocumentInfoSheet.module.css';
import styles from './DocumentTools.module.css';
import {
  handlerLabel,
  passwordSources,
  restrictedSources,
  restrictionList,
  securityOutcome,
  sourcesOf,
} from './security-text';

export function SecurityInfo({ doc }: { readonly doc: VirtualDocument }) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const restricted = restrictedSources(ws, doc);
  const encrypted = sourcesOf(ws, doc).filter((s) => s.flags.encrypted);
  const locked = passwordSources(ws, doc);
  const canRemove = doc.security !== undefined || (encrypted.length > 0 && !doc.passwordRemoved);
  const reapply = locked.length > 0 && doc.security === undefined && !doc.passwordRemoved;
  return (
    <SheetGroup
      label={m.info_security()}
      footnote={reapply ? m.security_reapply_hint() : undefined}
      data-testid="security-info"
    >
      {restricted.map((source) => (
        <SheetRow full key={source.id}>
          <details className={styles.notice} data-testid="restricted-notice">
            <summary>
              <Badge kind="label">{m.badge_restricted()}</Badge>{' '}
              {m.restricted_summary({
                // restrictedSources only lists sources with permissions.
                restricted: restrictionList(source.flags.permissions as PermissionFlags),
              })}
            </summary>
            <p>
              {m.restricted_explanation({
                name: source.name,
                handler: handlerLabel(source.flags.securityHandler),
              })}
            </p>
          </details>
        </SheetRow>
      ))}
      {encrypted.length > 0 ? (
        <SheetRow
          title={m.security_source()}
          description={encrypted
            .map((s) =>
              m.security_source_line({
                handler: handlerLabel(s.flags.securityHandler),
                kind:
                  s.flags.passwordProtected === true
                    ? m.security_kind_password()
                    : m.security_kind_owner(),
              }),
            )
            .join('; ')}
        />
      ) : null}
      <SheetRow
        title={m.security_on_export()}
        description={
          <span data-testid="security-outcome">
            {doc.passwordRemoved && doc.security === undefined
              ? m.security_outcome_removed_requested()
              : securityOutcome(doc.security, encrypted.length)}
          </span>
        }
      />
      <SheetRow full className={layout.buttons}>
        <Button variant="standard" onClick={() => openDocumentDialog('set-password', doc.id)}>
          {doc.security ? m.cmd_change_password() : m.cmd_set_password()}
        </Button>
        {canRemove ? (
          <Button variant="standard" onClick={() => openDocumentDialog('remove-password', doc.id)}>
            {m.cmd_remove_password()}
          </Button>
        ) : null}
      </SheetRow>
    </SheetGroup>
  );
}
