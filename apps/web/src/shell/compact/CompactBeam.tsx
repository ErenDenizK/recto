/**
 * The phone Home's beam (DSN-94, EDN-29): the sample cover's lamp continued across the screen as
 * a static CSS light, a port of the Home's Beam for the phone's own geometry (it does not import
 * `home/`). Three layers share one clipped wedge that thins towards the lamp: a wide soft
 * body, a mid layer and a thin bright core, each blurred and faded on its own. No motion, no
 * script. The lamp stands off the right edge at x 470, y 61.6 % of the window, the beam leaving it
 * at 186 degrees, 700 px long and 160 px across, at intensity 0.45 (`CompactLibrary.module.css`).
 *
 * It degrades by dropping the body at degrade steps 3 and 4 and to the core alone under Solid
 * glass. Decorative: `aria-hidden`, behind the column and pointer-transparent.
 */
import styles from './CompactBeam.module.css';

export function CompactBeam() {
  return (
    <div className={styles.beam} aria-hidden="true" data-testid="compact-beam">
      {/* The blur and the fade are the layer's; the wedge it is clipped to is its child's, so the
          blur is cut by nothing (a clip on the same box would cut it hard). */}
      <div className={`${styles.layer} ${styles.body}`}>
        <div className={styles.wedge} />
      </div>
      <div className={`${styles.layer} ${styles.mid}`}>
        <div className={styles.wedge} />
      </div>
      <div className={`${styles.layer} ${styles.core}`}>
        <div className={styles.wedge} />
      </div>
    </div>
  );
}
