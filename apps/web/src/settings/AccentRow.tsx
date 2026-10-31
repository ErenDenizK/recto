/**
 * Theme colour (DSN-88; Fener, behind the Labs toggle `fener`): Çivit · Mor · Mavi, the row
 * after Theme in Appearance, shown only while the flag is on. The row's button shows the
 * colour in force; it opens a picker of three swatches with their names, one `radiogroup` on
 * Base UI's `RadioGroup` (one Tab stop, the arrows move and choose, as `ui/SwatchGroup`).
 * A choice applies at once through a root cross-fade (`appearance-commands`) and is kept per
 * device (`state/fener.ts`).
 *
 * Motion: the picker is the one popover recipe (`ui/Popover.module.css`), opening on
 * `--spring-quick` from 0.96 and closing in `--duration-fast`; the chosen swatch's ring lands on
 * `--spring-pop` (`AccentRow.module.css`).
 *
 * Kept apart from `sections.tsx`, as `ThemeRow.tsx` is, so the compact edition's About sheet
 * shows it too (ADR-0033).
 */
import { Popover } from '@base-ui/react/popover';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { useState } from 'react';

import { m } from '../i18n';
import { FENER_PRESETS, type FenerPreset, useFenerStore } from '../state/fener';
import { Button } from '../ui/Button';
import { PopoverPopup } from '../ui/Popover';
import { ACCENT_NAME, setAccent } from './accent';
import styles from './AccentRow.module.css';
import { Line, Row } from './rows';

function Dot({ preset }: { readonly preset: FenerPreset }) {
  return <span className={styles.dot} data-preset={preset} aria-hidden="true" />;
}

export function AccentRow() {
  const accent = useFenerStore((s) => s.accent);
  const [open, setOpen] = useState(false);
  return (
    <Row id="accent" bar>
      <Line label={m.settings_accent()} description={m.settings_accent_hint()}>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger
            render={
              <Button variant="standard" icon={<Dot preset={accent} />}>
                {ACCENT_NAME[accent]()}
              </Button>
            }
            aria-label={`${m.settings_accent()}: ${ACCENT_NAME[accent]()}`}
          />
          <PopoverPopup side="bottom" align="end" aria-label={m.settings_accent()}>
            <RadioGroup
              aria-label={m.settings_accent()}
              value={accent}
              onValueChange={(next) => {
                if (next !== accent) setAccent(next);
              }}
              className={styles.group}
            >
              {FENER_PRESETS.map((preset) => (
                <Radio.Root
                  key={preset}
                  value={preset}
                  aria-label={ACCENT_NAME[preset]()}
                  className={styles.swatch}
                >
                  <span className={styles.ring} aria-hidden="true" />
                  <Dot preset={preset} />
                  <span className={styles.name}>{ACCENT_NAME[preset]()}</span>
                </Radio.Root>
              ))}
            </RadioGroup>
          </PopoverPopup>
        </Popover.Root>
      </Line>
    </Row>
  );
}
