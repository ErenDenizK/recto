/**
 * Theme: System · Light · Dark (ADR-0022 §2.4; spec D3-7; components/09-primitives.md §1.2's
 * phone sketch and 07-sheets.md S3: the first row of Appearance), a segmented control bound to
 * `appearance-store`'s `theme`, applied at once (`state/theme.ts` writes `data-theme`, the boot
 * script repeats it before the next load's first paint) and persisted there. System follows the
 * device's scheme and says so under the control.
 *
 * Kept apart from `sections.tsx`, as `ReduceMotionRow.tsx` is, so the compact edition's About
 * sheet shows it too without the rest of the Settings sheet's stores: the phone follows the
 * theme like every other size (ADR-0033).
 */
import { m } from '../i18n';
import { setTheme } from '../shell/appearance-commands';
import { type ThemeSetting, useAppearanceStore } from '../state/appearance-store';
import { Segmented } from '../ui/Segmented';
import { Line, Row } from './rows';
import styles from './Settings.module.css';

export function ThemeRow() {
  const theme = useAppearanceStore((s) => s.theme);
  return (
    <Row id="theme" bar>
      <Line label={m.settings_theme()} labelHidden description={m.settings_theme_hint()}>
        <div className={styles.segmented} data-values="3">
          <Segmented<ThemeSetting>
            label={m.settings_theme()}
            value={theme}
            onValueChange={(next) => {
              if (next !== theme) setTheme(next);
            }}
            options={[
              { value: 'system', label: m.settings_theme_system() },
              { value: 'light', label: m.settings_theme_light() },
              { value: 'dark', label: m.settings_theme_dark() },
            ]}
          />
        </div>
      </Line>
    </Row>
  );
}
