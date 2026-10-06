/**
 * ◆ Library (`components/01-frame.md` F3): the strip's first button, the Recto glyph in a
 * 32 / 44 px circle (the interim glyph until the owner's mark, D4-8). Click, Enter or `0`
 * shows the Library (`view.home`). On the Library it is current: the n5 fill, the label
 * "Library" beside the glyph (medium and up) and `aria-current="page"`. It replaces the title
 * bar's Home button (`AppGlyph.tsx`'s `HomeButton`; the glyph stays there for the compact
 * edition and Settings).
 */
import { commandRegistry } from '../../commands/registry';
import { currentPlatform, toAriaKeyShortcut } from '../../commands/shortcuts';
import { m } from '../../i18n';
import { Tooltip } from '../../ui/Tooltip';
import { AppGlyph } from '../AppGlyph';
import { useCommandShortcut } from '../use-command-shortcut';
import styles from './TopStrip.module.css';

export function LibraryButton({ current }: { readonly current: boolean }) {
  const shortcut = useCommandShortcut('view.home');
  return (
    <Tooltip label={m.frame_library()} shortcut={shortcut}>
      <button
        type="button"
        className={styles.library}
        aria-label={m.frame_library()}
        aria-current={current ? 'page' : undefined}
        aria-keyshortcuts={shortcut ? toAriaKeyShortcut(shortcut, currentPlatform) : undefined}
        data-testid="home-button"
        onClick={() => void commandRegistry.execute('view.home')}
      >
        <AppGlyph size={20} />
        {current ? (
          <span className={styles.libraryLabel} aria-hidden="true">
            {m.frame_library()}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}
