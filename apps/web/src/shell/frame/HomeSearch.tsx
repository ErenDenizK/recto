/**
 * The Home strip's search (DSN-93; Colophon plan L2): a 420 x 36 smoked-glass field (360 under
 * 1280 px, a 36 px magnifier button under 900 px) that is a button, not an input: it runs
 * `view.palette`, so files and commands are found in one place. Centred absolutely in the
 * strip, so the brand and the status never move it.
 */
import { commandRegistry } from '../../commands/registry';
import { m } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { Keycaps } from '../../ui/Keycaps';
import { Tooltip } from '../../ui/Tooltip';
import { useCommandShortcut } from '../use-command-shortcut';
import { currentPlatform, toAriaKeyShortcut } from '../../commands/shortcuts';
import styles from './HomeStrip.module.css';

export function HomeSearch() {
  const shortcut = useCommandShortcut('view.palette');
  const label = m.home_search();
  return (
    <Tooltip label={label} shortcut={shortcut}>
      {/* The Home strip's own control, a field-shaped button (no ui/Button form fits). */}
      <button
        type="button"
        // eslint-disable-next-line recto/q9-controls
        className={styles.search}
        aria-label={label}
        aria-keyshortcuts={shortcut ? toAriaKeyShortcut(shortcut, currentPlatform) : undefined}
        data-testid="home-search"
        onClick={() => void commandRegistry.execute('view.palette')}
      >
        <Icon name="magnifying-glass" aria-hidden="true" />
        <span className={styles.searchText}>{label}</span>
        {shortcut ? <Keycaps shortcut={shortcut} /> : null}
      </button>
    </Tooltip>
  );
}
