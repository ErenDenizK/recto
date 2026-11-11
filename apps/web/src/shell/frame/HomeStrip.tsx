/**
 * The Home strip (DSN-93; Colophon plan L2): 64 high, no glass pieces. Brand (the mark and
 * "recto", not a control), the centred search, then "On this device" and Settings. Tab order:
 * search, status, gear. Open documents live on Home's Open shelf, so there are no tabs here.
 */
import { BrandMark } from '../../brand/BrandMark';
import { m } from '../../i18n';
import { openSettings } from '../../settings/open-settings';
import { Icon } from '../../ui/Icon';
import { Tooltip } from '../../ui/Tooltip';
import { HomeSearch } from './HomeSearch';
import styles from './HomeStrip.module.css';
import { LocalStatus } from './LocalStatus';

export function HomeStrip() {
  return (
    <>
      <div className={styles.brand} data-top-side="lead">
        <BrandMark size={24} />
        {/* The product name is not translated. */}
        <span className={styles.wordmark} aria-hidden="true">
          recto
        </span>
      </div>
      <HomeSearch />
      <div className={styles.trail} data-top-side="trail">
        <LocalStatus />
        <Tooltip label={m.settings_command()}>
          <button
            type="button"
            // eslint-disable-next-line recto/q9-controls
            className={styles.gear}
            aria-label={m.settings_command()}
            data-testid="home-settings"
            onClick={(event) => openSettings(undefined, { returnTo: event.currentTarget })}
          >
            <Icon name="gear-six" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </>
  );
}
