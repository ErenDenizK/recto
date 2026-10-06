/**
 * Reduce motion: System · On (language.md §7.6; spec D3-4; components/07-sheets.md S3 §2, §4),
 * the one row both editions show: the Settings sheet's Appearance section and the compact
 * edition's About sheet (ADR-0033 §2.3, which has no Settings sheet). It is a segmented
 * control bound to `appearance-store`'s `motion`, applied at once and persisted there; when the
 * system asks for reduced motion it shows On, both segments disabled, and says "On, set by
 * your system" (07 S3 §4), announced when the system changes while the row is on screen.
 *
 * Kept apart from `sections.tsx` so the compact edition takes this row without the rest of
 * the Settings sheet's stores.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { m } from '../i18n';
import { subscribeReducedMotion, systemReducedMotion } from '../motion/reduced-motion';
import { announce } from '../shell/announcer';
import { setMotion } from '../shell/appearance-commands';
import { type MotionSetting, useAppearanceStore } from '../state/appearance-store';
import { Segmented } from '../ui/Segmented';
import { Line, Row } from './rows';
import styles from './Settings.module.css';

/** Whether the system asks for reduced motion, from the motion module (the one source, A-9). */
function useSystemMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, systemReducedMotion, () => false);
}

/** Announces the system turning a setting on while the sheet is open, never the first read. */
export function useAnnounceSystem(system: boolean, say: () => string): void {
  const seen = useRef(system);
  useEffect(() => {
    if (seen.current === system) return;
    seen.current = system;
    if (system) announce(say());
  }, [system, say]);
}

export function ReduceMotionRow() {
  const motion = useAppearanceStore((s) => s.motion);
  const system = useSystemMotion();
  useAnnounceSystem(system, m.settings_reduce_motion_system_on);
  return (
    <Row id="reduceMotion" bar>
      <Line
        label={m.settings_reduce_motion()}
        labelHidden
        description={system ? m.switch_system_on() : m.settings_reduce_motion_hint()}
      >
        <div className={styles.segmented}>
          <Segmented<MotionSetting>
            label={m.settings_reduce_motion()}
            value={system ? 'reduced' : motion}
            onValueChange={(next) => {
              if (next !== motion) setMotion(next);
            }}
            options={[
              {
                value: 'system',
                label: m.settings_reduce_motion_system(),
                disabled: system,
                reason: system ? m.switch_system_on() : undefined,
              },
              {
                value: 'reduced',
                label: m.settings_reduce_motion_on(),
                disabled: system,
                reason: system ? m.switch_system_on() : undefined,
              },
            ]}
          />
        </div>
      </Line>
    </Row>
  );
}
