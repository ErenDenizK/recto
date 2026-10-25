/**
 * The read-aloud player (PRD-34, behind `?read=1`): one small bar piece above the capsule, in the free
 * area, in the capsule and ink strip's family (`mat-bar`, `--piece-h`). Play or Pause, Previous
 * and Next sentence, Speed (0.8× to 1.5×), the voice, and Close. With no on-device voice it says
 * so in place of the controls and speaks nothing.
 */
import { useEffect, useRef } from 'react';

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
  const open = useReadAloudStore((s) => s.open);
  const status = useReadAloudStore((s) => s.status);
  const availability = useReadAloudStore((s) => s.availability);
  const voiceUri = useReadAloudStore((s) => s.voiceUri);
  const rate = useReadAloudStore((s) => s.rate);
  const pageEmpty = useReadAloudStore((s) => s.pageEmpty);
  const play = useRef<HTMLButtonElement>(null);
  // Opened from More, focus would go back to More as its menu closes a moment later; it comes to
  // Play instead (asked again until the menu has let go). Opened by a key or the palette, focus
  // stays where it was, so no ring or tooltip shows that nobody asked for.
  useEffect(() => {
    if (!open) return;
    const take = () => {
      if (document.activeElement?.closest('[data-dock-item="more"]')) {
        play.current?.focus({ focusVisible: false });
      }
    };
    take();
    const timers = [120, 320].map((ms) => window.setTimeout(take, ms));
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [open]);
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
      data-read-aloud-player=""
      data-testid="read-aloud-player"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          closeReadAloud();
        }
      }}
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
            ref={play}
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
