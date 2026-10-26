/**
 * The Aa popover of the Text view (DSN-84, PRD-36 "Settings"): text size (− and + with the size
 * between them, seven steps), line spacing, theme and, if the owner takes the serif (DSN-84's
 * option B), the typeface. Each change is `setReadingPrefs` at once, so the view changes behind
 * the popover and keeps the block at its top. It is the popover recipe (`ui/Popover.tsx`: M4
 * glass, container transform from Aa); Esc closes it and focus goes back to Aa.
 */
import { Popover } from '@base-ui/react/popover';

import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { PopoverPopup } from '../ui/Popover';
import { Segmented } from '../ui/Segmented';
import type { ReadingFace, ReadingSpacing, ReadingTheme } from './contract';
import styles from './ReadingOptions.module.css';
import { setReadingPrefs, stepSize, TEXT_SIZES, useReadingPrefs } from './reading-prefs';

export function ReadingOptions() {
  const prefs = useReadingPrefs();
  const px = TEXT_SIZES[prefs.size] ?? TEXT_SIZES[2];
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <IconButton
            label={m.text_view_options()}
            icon={<Icon name="text-aa" />}
            tooltipSide="top"
            data-testid="text-view-options"
          />
        }
      />
      <PopoverPopup
        side="top"
        align="end"
        sideOffset={16}
        aria-label={m.text_view_options()}
        className={styles.popup}
        data-testid="text-view-options-popup"
      >
        <div className={styles.row}>
          <span className={styles.label}>{m.text_view_size()}</span>
          <div className={styles.stepper} role="group" aria-label={m.text_view_size()}>
            <IconButton
              label={m.text_view_smaller()}
              icon={<Icon name="minus" />}
              disabled={prefs.size <= 0}
              onClick={() => stepSize(-1)}
            />
            <span className={styles.value} aria-live="polite" data-testid="text-view-size">
              {px}
            </span>
            <IconButton
              label={m.text_view_larger()}
              icon={<Icon name="plus" />}
              disabled={prefs.size >= TEXT_SIZES.length - 1}
              onClick={() => stepSize(1)}
            />
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{m.text_view_spacing()}</span>
          <Segmented<ReadingSpacing>
            label={m.text_view_spacing()}
            value={prefs.spacing}
            onValueChange={(spacing) => setReadingPrefs({ spacing })}
            options={[
              { value: 'tight', label: m.text_view_spacing_tight() },
              { value: 'normal', label: m.text_view_spacing_normal() },
              { value: 'loose', label: m.text_view_spacing_loose() },
            ]}
            frameClassName={styles.control}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{m.text_view_theme()}</span>
          <Segmented<ReadingTheme>
            label={m.text_view_theme()}
            value={prefs.theme}
            onValueChange={(theme) => setReadingPrefs({ theme })}
            options={[
              { value: 'auto', label: m.text_view_theme_auto() },
              { value: 'light', label: m.text_view_theme_light() },
              { value: 'dark', label: m.text_view_theme_dark() },
            ]}
            frameClassName={styles.control}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{m.text_view_face()}</span>
          <Segmented<ReadingFace>
            label={m.text_view_face()}
            value={prefs.face}
            onValueChange={(face) => setReadingPrefs({ face })}
            options={[
              { value: 'sans', label: m.text_view_face_sans() },
              { value: 'serif', label: m.text_view_face_serif() },
            ]}
            frameClassName={styles.control}
          />
        </div>
      </PopoverPopup>
    </Popover.Root>
  );
}
