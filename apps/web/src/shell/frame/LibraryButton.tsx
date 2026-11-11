/**
 * ◆ Library (`components/01-frame.md` F3): the strip's first button, the Recto mark
 * (`BrandMark` 24, the gradient on dark) alone, no label (Colophon L2). Click, Enter or `0`
 * shows Home (`view.home`). Only the document strip mounts it: Home has its own strip
 * (`HomeStrip`, where the mark is the brand and not a control).
 */
import { BrandMark } from '../../brand/BrandMark';
import { commandRegistry } from '../../commands/registry';
import { currentPlatform, toAriaKeyShortcut } from '../../commands/shortcuts';
import { m } from '../../i18n';
import { Tooltip } from '../../ui/Tooltip';
import { useCommandShortcut } from '../use-command-shortcut';
import styles from './TopStrip.module.css';

export function LibraryButton() {
  const shortcut = useCommandShortcut('view.home');
  return (
    <Tooltip label={m.frame_library()} shortcut={shortcut}>
      {/* The strip's ◆ (F3): the brand mark in a circle that grows into a labelled capsule on
          the Library, its own control rather than ui/Button's text capsule. */}
      <button
        type="button"
        // eslint-disable-next-line recto/q9-controls
        className={styles.library}
        aria-label={m.frame_library()}
        aria-keyshortcuts={shortcut ? toAriaKeyShortcut(shortcut, currentPlatform) : undefined}
        data-testid="home-button"
        onClick={() => void commandRegistry.execute('view.home')}
      >
        <BrandMark size={24} />
      </button>
    </Tooltip>
  );
}
