/**
 * The Redo chip (EDN-24, Labs `phone-capsule`): a 44 px glass circle above Undo that shows only
 * while there is a step to redo (`history.future`). It enters from Undo (scale .6 to 1 and a fade
 * on `quick`) and leaves on `--duration-fast`; reduced motion is a fade (A-9). If focus is on it
 * when it goes, focus moves to Undo. It carries the attributes the selection bar and keyboard
 * band use to stay clear of it (`data-compact-above-capsule`) and that keep a press on it from
 * reaching the page (`data-annotation-keep`).
 */
import { useLayoutEffect, useRef, useState } from 'react';

import { m } from '../../../i18n';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { redo } from './bridge';
import styles from './RedoChip.module.css';

export function RedoChip() {
  const redoable = useWorkspaceStore((s) => s.history.future.length > 0);
  const [shown, setShown] = useState(redoable);
  if (redoable && !shown) setShown(true);
  const ref = useRef<HTMLButtonElement>(null);

  // Focus on the chip when it goes: Undo takes it, so the keyboard keeps its place.
  useLayoutEffect(() => {
    const chip = ref.current;
    if (redoable || !chip || document.activeElement !== chip) return;
    document
      .querySelector<HTMLElement>('[data-testid="compact-undo"]')
      ?.focus({ preventScroll: true });
  }, [redoable]);

  if (!shown) return null;
  return (
    <IconButton
      ref={ref}
      label={m.compact_redo()}
      tooltipSide="top"
      icon={<Icon name="arrow-u-up-right" />}
      className={styles.chip}
      data-leaving={redoable ? undefined : ''}
      data-compact-chrome=""
      data-annotation-keep=""
      data-compact-above-capsule=""
      data-testid="compact-redo"
      tabIndex={redoable ? undefined : -1}
      onClick={() => redo()}
      onAnimationEnd={() => {
        if (!redoable) setShown(false);
      }}
    />
  );
}
