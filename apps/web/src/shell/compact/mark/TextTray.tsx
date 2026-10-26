/**
 * The Text tray of the single capsule (EDN-24, plan "Text tray"): an Edit text switch, then the
 * Text options (`TextOptions.tsx`, reused). The switch arms Edit text and switches it back to
 * Text (a paragraph steps the chrome away as EDN-17 does). With it on, the colours and sizes give
 * way to the one line `compact_edit_text_hint`: they style new boxes, which Edit text does not
 * make. Seven targets of 44 px with it off, as every tray (`CapsuleTray.tsx`).
 */
import { m } from '../../../i18n';
import { receivePulse } from '../../../motion/receive';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { useCompactStore } from '../compact-store';
import { armTool } from './bridge';
import styles from './TextTray.module.css';
import { TextOptions } from './TextOptions';

export function TextTray() {
  const on = useCompactStore((s) => s.tool === 'edit-text');
  return (
    <>
      <Button
        variant="quiet"
        role="switch"
        className={styles.switch}
        aria-checked={on}
        aria-label={m.compact_tool_edit_text()}
        data-testid="compact-edit-text-switch"
        onClick={(event) => {
          void receivePulse(event.currentTarget);
          armTool(on ? 'text' : 'edit-text');
        }}
      >
        <Icon name="edit-text" filled={on} />
      </Button>
      <span className={styles.rule} aria-hidden="true" />
      {on ? (
        <p className={styles.hint} data-testid="compact-edit-text-hint">
          {m.compact_edit_text_hint()}
        </p>
      ) : (
        <TextOptions />
      )}
    </>
  );
}
