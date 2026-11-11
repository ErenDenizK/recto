/**
 * The first visit (DSN-93, `home-first.html`): Recents read and empty, nothing open, nothing to
 * continue. The 60 px heading at the left margin, 86 above a row of buttons (Open or drop files
 * as the one primary, Combine and Sign as ghosts, then ⌘K "More" as a quiet text button), and the
 * Margin cover on the right at 420 wide with the lit shelf line at its foot and, 18 below it, its
 * serif name on the left and "Try the sample ↗" in lime on the right. A press on the cover or
 * the caption opens the sample: the caption's button is the one stop and its ::after covers the
 * block. The beam (`Beam.tsx`) leaves the cover's lamp (`data-beam-anchor`).
 */
import { useId } from 'react';

import { commandRegistry } from '../commands/registry';
import { useCommand } from '../commands/use-commands';
import { m } from '../i18n';
import { openSample } from '../sample/open-sample';
import { SampleCover } from '../sample/SampleCover';
import { openScan } from '../scan/scan-flag';
import { useWorkspaceStore } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Keycaps } from '../ui/Keycaps';
import { dropTitle } from './DropOverlay';
import styles from './FirstVisit.module.css';
import { combineFiles, openPdfs } from './home-actions';
import { SAMPLE_NAME } from './sample-name';
import { useSampleAvailable } from './use-sample-available';

export function FirstVisit({
  dragging,
  dragCount,
  scan,
}: {
  readonly dragging: boolean;
  readonly dragCount: number | undefined;
  /** The Scan button shows (scan is on and a camera exists). */
  readonly scan: boolean;
}) {
  const opening = useWorkspaceStore((s) => s.opening > 0);
  const available = useSampleAvailable();
  const palette = useCommand('view.palette');
  const lineId = useId();
  return (
    <div className={styles.first} data-dragging={dragging || undefined}>
      <div className={styles.copy}>
        <h1 className={styles.headline}>{dragging ? dropTitle(dragCount) : m.home_headline()}</h1>
        <div
          className={styles.actions}
          role="group"
          aria-label={m.desk_intents_label()}
          data-dragging={dragging || undefined}
          data-testid="library-launcher"
        >
          <Button
            variant="prominent"
            size="lg"
            className={`${styles.action} ${styles.open}`}
            icon={<Icon name="folder-open" size={20} />}
            aria-busy={opening || undefined}
            data-library-open=""
            data-testid="library-open"
            onClick={() => void openPdfs()}
          >
            {m.home_open_drop()}
          </Button>
          <Button
            variant="standard"
            size="lg"
            className={styles.action}
            data-ghost=""
            icon={<Icon name="stack" size={20} />}
            data-testid="library-combine-files"
            onClick={() => void combineFiles()}
          >
            {m.home_combine_short()}
          </Button>
          <Button
            variant="standard"
            size="lg"
            className={styles.action}
            data-ghost=""
            icon={<Icon name="signature" size={20} />}
            data-testid="library-sign"
            onClick={() => void commandRegistry.execute('file.signPdf')}
          >
            {m.home_sign_short()}
          </Button>
          {scan ? (
            <Button
              variant="standard"
              size="lg"
              className={styles.action}
              data-ghost=""
              icon={<Icon name="scan" size={20} />}
              data-testid="library-scan"
              onClick={openScan}
            >
              {m.scan_button()}
            </Button>
          ) : null}
          <Button
            variant="quiet"
            size="lg"
            className={`${styles.action} ${styles.more}`}
            data-testid="home-all-commands"
            onClick={() => void commandRegistry.execute('view.palette')}
          >
            {palette?.shortcuts[0] === undefined ? null : (
              <Keycaps shortcut={palette.shortcuts[0]} />
            )}
            {m.home_more()}
          </Button>
        </div>
      </div>
      <section
        className={styles.sample}
        data-testid="desk-sample"
        data-unavailable={available ? undefined : true}
        aria-labelledby={`${lineId}-name`}
      >
        <span className={styles.cover} data-beam-anchor="" aria-hidden="true">
          <span className={styles.sheet} data-library-sheet="">
            <SampleCover className={styles.drawing} />
          </span>
        </span>
        <div className={styles.caption}>
          <span id={`${lineId}-name`} className={styles.name}>
            {SAMPLE_NAME}
          </span>
          {available ? null : (
            <span id={lineId} className="visually-hidden">
              {m.sample_offline()}
            </span>
          )}
          <button
            type="button"
            // hand-styled link; the cover and caption are one press target
            // eslint-disable-next-line recto/q9-controls
            className={styles.try}
            aria-disabled={available ? undefined : true}
            aria-describedby={available ? undefined : lineId}
            data-testid="home-try-sample"
            onClick={() => {
              if (available) void openSample();
            }}
          >
            {m.home_try_sample()}
            <Icon name="arrow-up-right" size={16} />
          </button>
        </div>
      </section>
      <span className={styles.line} aria-hidden="true" data-shelf-line="" />
    </div>
  );
}
