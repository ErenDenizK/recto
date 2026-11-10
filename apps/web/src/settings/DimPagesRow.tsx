/**
 * Dim pages (DESIGN.md §3's comfort toggle; decisions MOB-16 step 1, MOB-17): a switch bound to
 * `appearance-store`'s `dimPages`, off by default, applied at once and persisted there
 * (`tokens.css` §5).
 *
 * Kept apart from `sections.tsx` so the compact edition's About sheet shows it too (ADR-0033):
 * a phone in bed at night is where it helps most.
 */
import { m } from '../i18n';
import { setDimPages } from '../shell/appearance-commands';
import { useAppearanceStore } from '../state/appearance-store';
import { Switch } from '../ui/Switch';
import { Row } from './rows';
import styles from './Settings.module.css';

export function DimPagesRow() {
  const dimPages = useAppearanceStore((s) => s.dimPages);
  return (
    <Row id="dimPages">
      <Switch
        className={styles.switch}
        label={m.settings_dim_pages()}
        description={m.settings_dim_pages_hint()}
        checked={dimPages}
        onCheckedChange={setDimPages}
      />
    </Row>
  );
}
