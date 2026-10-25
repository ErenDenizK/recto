/**
 * The read-aloud player (PRD-34, behind `?read=1`): one small bar piece at the top of the free
 * area, in the capsule and ink strip's family (`mat-bar`, `--piece-h`). Play or Pause, Previous
 * and Next sentence, Speed (0.8× to 1.5×), the voice, and Close. With no on-device voice it says
 * so in place of the controls and speaks nothing.
 */
import { getLocale, m } from '../../i18n';
import { languageName } from '../../ocr/ocr-model';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { Select } from '../../ui/Select';
import { Surface } from '../../ui/Surface';
import {
  closeReadAloud,
  RATES,
  setRate,
  setVoice,
  stepSentence,
  togglePlay,
  useReadAloudStore,
  voiceChoices,
} from './controller';
import styles from './ReadAloudPlayer.module.css';

const rateLabel = (rate: number) => `${rate}×`;

export function ReadAloudPlayer() {
  const { open, status, availability, voiceUri, rate, pageEmpty } = useReadAloudStore();
  if (!open) return null;
  const choices = voiceChoices(availability);
  const note =
    availability?.kind === 'network-only'
      ? m.read_aloud_network_only()
      : availability?.kind === 'no-language'
        ? m.read_aloud_no_voice({ language: languageName(availability.language, getLocale()) })
        : pageEmpty && status === 'idle'
          ? m.read_aloud_no_text()
          : null;
  const playing = status === 'playing';
  return (
    <Surface
      tier="bar"
      sigma={8}
      coarse={9}
      short={8}
      as="section"
      className={styles.player}
      aria-label={m.read_aloud_title()}
      data-testid="read-aloud-player"
      data-status={status}
    >
      {note ? (
        <p className={styles.note} role="status" data-testid="read-aloud-note">
          {note}
        </p>
      ) : (
        <>
          <IconButton
            label={m.read_aloud_previous()}
            icon={<Icon name="skip-back" />}
            onClick={() => stepSentence(-1)}
            data-testid="read-aloud-previous"
          />
          <IconButton
            label={playing ? m.read_aloud_pause() : m.read_aloud_play()}
            icon={<Icon name={playing ? 'pause' : 'play'} filled />}
            onClick={togglePlay}
            data-testid="read-aloud-play"
          />
          <IconButton
            label={m.read_aloud_next()}
            icon={<Icon name="skip-forward" />}
            onClick={() => stepSentence(1)}
            data-testid="read-aloud-next"
          />
          <Select
            value={String(rate)}
            onValueChange={(next) => setRate(Number(next))}
            options={RATES.map((r) => ({ value: String(r), label: rateLabel(r) }))}
            label={m.read_aloud_speed()}
            className={styles.speed}
            data-testid="read-aloud-speed"
          />
          <Select
            value={voiceUri}
            onValueChange={setVoice}
            options={choices.map((c) => ({ value: c.uri, label: c.name }))}
            label={m.read_aloud_voice()}
            className={styles.voice}
            data-testid="read-aloud-voice"
          />
        </>
      )}
      <IconButton
        label={m.read_aloud_close()}
        icon={<Icon name="x" />}
        onClick={closeReadAloud}
        data-testid="read-aloud-close"
      />
    </Surface>
  );
}
