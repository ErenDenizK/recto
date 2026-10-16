/**
 * Try the sample as a card (`02-library` L10; DSN-50): the third tier of the Library, after
 * opening a file and Recents. The phone's card (DSN-31, `CompactLibrary`) in the full Library's
 * glass: lit, with the sample's cover drawn small (`SampleCover`, static, so the Library loads
 * no engine for it), "Try the sample" and one line saying what it is, and a caret.
 *
 * Offline before the sample was ever loaded the card is dimmed and stays focusable
 * (`aria-disabled`), and its line becomes the reason, so a touch screen shows it too (a
 * tooltip needs a long press there, 09 §2.3). Its name stays "Try the sample"; the line is its
 * description. A press scales it as a lens does (MOT-10); hover lights its rim (GLS-25), it
 * never lifts: a blurred shadow that moves repaints every frame on WebKit (GLS-22, amended).
 */
import { useId } from 'react';

import { m } from '../i18n';
import { openSample } from '../sample/open-sample';
import { SampleCover } from '../sample/SampleCover';
import { Icon } from '../ui/Icon';
import lit from './lit.module.css';
import styles from './SampleCard.module.css';
import { useSampleAvailable } from './use-sample-available';

export function SampleCard({ align }: { readonly align: 'centre' | 'start' }) {
  const available = useSampleAvailable();
  const lineId = useId();
  return (
    // A lit card, as a Library card is, not ui/Button's action capsule: the cover, two lines
    // and a caret, with its own press (02-library L10, DSN-50).
    <button
      type="button"
      // eslint-disable-next-line recto/q9-controls
      className={`${lit.lit} ${styles.card}`}
      data-lit=""
      data-align={align}
      aria-label={m.cmd_try_sample()}
      aria-disabled={available ? undefined : true}
      aria-describedby={lineId}
      data-testid="library-sample"
      onClick={() => {
        if (available) void openSample();
      }}
    >
      <SampleCover className={styles.cover} />
      <span className={styles.text}>
        <span className={styles.title}>{m.cmd_try_sample()}</span>
        <span id={lineId} className={styles.line}>
          {available ? m.library_sample_line() : m.sample_offline()}
        </span>
      </span>
      <Icon name="caret-right" className={styles.caret} />
    </button>
  );
}
