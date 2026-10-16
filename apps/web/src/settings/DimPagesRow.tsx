/**
 * Dim pages (DESIGN.md §3's comfort toggle; decisions MOB-16 step 1, MOB-17): a switch bound to
 * `appearance-store`'s `dimPages`, off by default, applied at once and persisted there. It acts
 * in the dark theme only (`tokens.css` §5), so in the light theme the switch keeps its value,
 * is disabled and says why ("Only in the dark theme"), as a setting the system forces does.
 *
 * Kept apart from `sections.tsx`, as `ThemeRow.tsx` is, so the compact edition's About sheet
 * shows it too (ADR-0033): a phone in bed at night is where it helps most.
 */
import { useSyncExternalStore } from 'react';

import { m } from '../i18n';
import { setDimPages } from '../shell/appearance-commands';
import { useAppearanceStore } from '../state/appearance-store';
import { resolveTheme, subscribeSystemTheme, type ThemeSetting } from '../state/theme';
import { Switch } from '../ui/Switch';
import { Row } from './rows';
import styles from './Settings.module.css';

/** The theme in force for `setting`, following the device live while it is System. */
function useResolvedTheme(setting: ThemeSetting) {
  return useSyncExternalStore(
    subscribeSystemTheme,
    () => resolveTheme(setting),
    () => 'dark' as const,
  );
}

export function DimPagesRow() {
  const dimPages = useAppearanceStore((s) => s.dimPages);
  const theme = useAppearanceStore((s) => s.theme);
  const light = useResolvedTheme(theme) === 'light';
  return (
    <Row id="dimPages">
      <Switch
        className={styles.switch}
        label={m.settings_dim_pages()}
        description={light ? m.settings_dim_pages_light() : m.settings_dim_pages_hint()}
        checked={dimPages}
        disabled={light}
        onCheckedChange={setDimPages}
      />
    </Row>
  );
}
