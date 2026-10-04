/**
 * The colour well and its panel together (`10-ink.md` §2.1, §4): the drop-in for the native
 * colour inputs that D0-3 ports.
 *
 * - The well is the popover's trigger; the panel is a non-modal dialog labelled by its
 *   title ("Colour"), anchored to the well, opening away from it (`side`), and focus returns
 *   to the well when it closes (§4.3).
 * - Esc belongs to the panel: it reverts to the colour from when the panel opened, then
 *   closes (§4.2). The popover's own Esc is set aside for it.
 * - While the eyedropper samples the page, the popover steps aside and stays mounted.
 */
import { Popover } from '@base-ui/react/popover';
import { useId, useState } from 'react';

import type { PixelSampler } from '../../viewer/page-pixels';
import { ColourPanel } from './ColourPanel';
import styles from './ColourPanel.module.css';
import { ColourWell } from './ColourWell';

export interface ColourPickerProps {
  /** `#RRGGBB` (or `NO_FILL` with `allowNoFill`). */
  readonly value: string;
  readonly opacity?: number | undefined;
  readonly onChange: (value: string, opacity: number | undefined) => void;
  readonly onCommit?: ((value: string, opacity: number | undefined) => void) | undefined;
  readonly preview?: { readonly width: number; readonly kind: 'pen' | 'highlighter' } | undefined;
  readonly allowNoFill?: boolean | undefined;
  readonly sampler?: PixelSampler | undefined;
  /** The well's accessible name (default "Colour: {name}"). */
  readonly label?: string | undefined;
  readonly side?: 'top' | 'bottom' | 'left' | 'right' | undefined;
  readonly disabled?: boolean | undefined;
}

export function ColourPicker({
  value,
  opacity,
  onChange,
  onCommit,
  preview,
  allowNoFill,
  sampler,
  label,
  side = 'top',
  disabled,
}: ColourPickerProps) {
  const [open, setOpen] = useState(false);
  const [sampling, setSampling] = useState(false);
  const titleId = useId();
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, details) => {
        // Esc is the panel's (revert, then close); while sampling it is the eyedropper's.
        if (!next && details.reason === 'escape-key') {
          details.cancel();
          details.allowPropagation();
          return;
        }
        // The eyedropper's layer is outside the popup: a press on the page is not a dismissal.
        if (!next && sampling) {
          details.cancel();
          return;
        }
        setOpen(next);
      }}
    >
      <Popover.Trigger
        disabled={disabled}
        render={
          <ColourWell
            value={value === 'none' ? '#FFFFFF' : value}
            opacity={opacity}
            label={label}
          />
        }
      />
      <Popover.Portal>
        <Popover.Positioner side={side} sideOffset={8} collisionPadding={8}>
          <Popover.Popup
            className={styles.popup}
            aria-labelledby={titleId}
            data-sampling={sampling ? '' : undefined}
          >
            <ColourPanel
              value={value}
              opacity={opacity}
              onChange={onChange}
              onCommit={onCommit}
              onClose={() => setOpen(false)}
              preview={preview}
              allowNoFill={allowNoFill}
              sampler={sampler}
              onSamplingChange={setSampling}
              titleId={titleId}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
