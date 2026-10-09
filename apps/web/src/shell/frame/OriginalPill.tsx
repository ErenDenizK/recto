/**
 * "Markup hidden · Show markup" (docs/plan/v1/PLAN.md S2-1a; `see-original.ts`): while the
 * title menu's eye is toggled on, a small floating piece under the strip's middle says the
 * pages show without their markup, and its button brings the markup back. A held peek needs
 * no pill: the press itself is the state.
 *
 * The state never outlives its document: switching documents or going to the Library brings
 * the markup back (`resetOriginal`).
 */
import { useEffect } from 'react';

import { m } from '../../i18n';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import styles from './OriginalPill.module.css';
import { resetOriginal, useOriginalStore } from './see-original';

export function OriginalPill({ onLibrary }: { readonly onLibrary: boolean }) {
  const toggled = useOriginalStore((s) => s.toggled);
  const active = useWorkspaceStore((s) => s.workspace.activeDocument);

  // Another document, or none, or the Library: the markup comes back.
  useEffect(() => resetOriginal, [active]);
  useEffect(() => {
    if (onLibrary) resetOriginal();
  }, [onLibrary]);

  if (!toggled || onLibrary) return null;
  return (
    <div className={styles.pill} role="status" data-testid="original-pill">
      <Icon name="eye-slash" className={styles.glyph} aria-hidden="true" />
      <span className={styles.label}>{m.original_pill()}</span>
      <Button variant="quiet" size="sm" onClick={resetOriginal}>
        {m.original_show()}
      </Button>
    </div>
  );
}
