/**
 * The rows of the Settings sheet's main list (components/07-sheets.md S3 §2, §4–§6; flows.md
 * §9.5; spec 07.8), each bound to the store that already holds the setting, applied at once and
 * persisted there; there is no Save button.
 *
 * - **Appearance:** Glass panels and Reduce transparency (`appearance-store`, craft §7). Reduce
 *   transparency is forced on by `prefers-reduced-transparency`: the switch then shows on, is
 *   disabled and says "On, set by your system" (A-17), and a change of that system value while
 *   the sheet is open is announced (07 S3 §6: system-overridden values only). Reduce motion:
 *   System · On (language.md §7.6; spec D3-4), a segmented control; when the system asks for
 *   reduced motion it shows On, both segments disabled, and says "On, set by your system"
 *   (07 S3 §4), announced the same way when the system changes while the sheet is open.
 * - **Language:** English · Türkçe · Follow the browser (07.8), names in their own language;
 *   applied without a reload (`locale.ts`), and the sheet comes back at this row after the
 *   shell remounts in the new language.
 * - **Pen and touch:** Pen draws in Edit (`input-policy-store`, craft §3.5), its effective value
 *   ("auto" is on once a pen has been seen).
 * - **Documents and storage:** Kept documents (pushes its page, D0-7's snapshots), Recent files
 *   with Clear, Name on comments (07.8; the annotation store's author), Show tips again (07.8).
 * - **More:** Privacy (pushes), Keyboard shortcuts (opens S22; on a coarse pointer only once a
 *   key has been pressed, L§6.2) and About Recto (pushes).
 */
import { useEffect, useId, useRef, useSyncExternalStore } from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import { commandRegistry } from '../commands/registry';
import { formatFileSize } from '../home/home-model';
import { useRecentsStore } from '../files/recents';
import {
  browserLocale,
  chooseLocale,
  followsBrowser,
  formatNumber,
  getLocale,
  LOCALE_NAMES,
  type Locale,
  locales,
  m,
  subscribeLocale,
  useLocale,
} from '../i18n';
import { subscribeReducedMotion, systemReducedMotion } from '../motion/reduced-motion';
import { useExternalRequests } from '../privacy/external-requests';
import { useSessionStore } from '../session/session-store';
import { announce } from '../shell/announcer';
import { setGlassPanels, setMotion, setReduceTransparency } from '../shell/appearance-commands';
import { BUILD_INFO, PRODUCT_NAME } from '../shell/about/build-info';
import { type MotionSetting, useAppearanceStore } from '../state/appearance-store';
import { useInputPolicyStore } from '../state/input-policy-store';
import { useUiStore } from '../state/ui-store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { Switch } from '../ui/Switch';
import { TextField } from '../ui/TextField';
import { setPenDrawsInMarkup, usePenDrawsInMarkup } from '../viewer/edit-policy';
import { openSettings } from './open-settings';
import { Line, NavRow, Row } from './rows';
import type { SettingsPageId, SettingsRowId } from './search-index';
import styles from './Settings.module.css';
import { showTipsAgain, tipsToShowAgain } from './settings-commands';

const TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)';

function subscribeQuery(query: string) {
  return (listener: () => void) => {
    const list = typeof matchMedia === 'function' ? matchMedia(query) : null;
    list?.addEventListener('change', listener);
    return () => list?.removeEventListener('change', listener);
  };
}
const subscribeTransparency = subscribeQuery(TRANSPARENCY_QUERY);
const systemTransparency = () =>
  typeof matchMedia === 'function' && matchMedia(TRANSPARENCY_QUERY).matches;

/** Whether the system asks for reduced transparency (Safari never reports it). */
function useSystemTransparency(): boolean {
  return useSyncExternalStore(subscribeTransparency, systemTransparency, () => false);
}

/** Whether the system asks for reduced motion, from the motion module (the one source, A-9). */
function useSystemMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, systemReducedMotion, () => false);
}

/** Announces the system turning a setting on while the sheet is open, never the first read. */
function useAnnounceSystem(system: boolean, say: () => string): void {
  const seen = useRef(system);
  useEffect(() => {
    if (seen.current === system) return;
    seen.current = system;
    if (system) announce(say());
  }, [system, say]);
}

export function GlassPanelsRow() {
  const on = useAppearanceStore((s) => s.glassPanels);
  return (
    <Row id="glassPanels">
      <Switch
        className={styles.switch}
        label={m.appearance_glass_panels()}
        description={m.settings_glass_panels_hint()}
        checked={on}
        onCheckedChange={setGlassPanels}
      />
    </Row>
  );
}

export function ReduceTransparencyRow() {
  const on = useAppearanceStore((s) => s.reduceTransparency);
  const system = useSystemTransparency();
  useAnnounceSystem(system, m.settings_reduce_transparency_system);
  return (
    <Row id="reduceTransparency">
      <Switch
        className={styles.switch}
        label={m.appearance_reduce_transparency()}
        description={m.settings_reduce_transparency_hint()}
        checked={on || system}
        system={system}
        onCheckedChange={setReduceTransparency}
      />
    </Row>
  );
}

export function ReduceMotionRow() {
  const motion = useAppearanceStore((s) => s.motion);
  const system = useSystemMotion();
  useAnnounceSystem(system, m.settings_reduce_motion_system_on);
  return (
    <Row id="reduceMotion" bar>
      <Line
        label={m.settings_reduce_motion()}
        labelHidden
        description={system ? m.switch_system_on() : m.settings_reduce_motion_hint()}
      >
        <div className={styles.segmented}>
          <Segmented<MotionSetting>
            label={m.settings_reduce_motion()}
            value={system ? 'reduced' : motion}
            onValueChange={(next) => {
              if (next !== motion) setMotion(next);
            }}
            options={[
              {
                value: 'system',
                label: m.settings_reduce_motion_system(),
                disabled: system,
                reason: system ? m.switch_system_on() : undefined,
              },
              {
                value: 'reduced',
                label: m.settings_reduce_motion_on(),
                disabled: system,
                reason: system ? m.switch_system_on() : undefined,
              },
            ]}
          />
        </div>
      </Line>
    </Row>
  );
}

type LanguageChoice = Locale | 'browser';

const choiceNow = (): LanguageChoice => (followsBrowser() ? 'browser' : getLocale());

export function LanguageRow() {
  const choice = useSyncExternalStore(subscribeLocale, choiceNow, choiceNow);
  const choose = (next: LanguageChoice) => {
    if (next === choice) return;
    // The shell remounts in the new language; the sheet comes back here.
    openSettings({ row: 'language' });
    const changed = chooseLocale(next);
    const say = () =>
      announce(
        next === 'browser'
          ? m.settings_language_followed({ language: LOCALE_NAMES[getLocale()] })
          : m.announce_language({ language: LOCALE_NAMES[getLocale()] }),
      );
    if (changed) setTimeout(say, 100);
    else say();
  };
  return (
    <Row id="language" bar>
      <Segmented<LanguageChoice>
        label={m.settings_section_language()}
        value={choice}
        onValueChange={choose}
        options={[
          ...locales.map((locale) => ({ value: locale, label: LOCALE_NAMES[locale] })),
          {
            value: 'browser' as const,
            label: m.settings_language_browser({ language: LOCALE_NAMES[browserLocale()] }),
          },
        ]}
      />
    </Row>
  );
}

export function PenDrawsRow() {
  const on = usePenDrawsInMarkup();
  const auto = useInputPolicyStore((s) => s.penDrawsInMarkup === 'auto');
  return (
    <Row id="penDrawsInEdit">
      <Switch
        className={styles.switch}
        label={m.pen_draws_in_edit()}
        description={auto ? m.settings_pen_draws_hint() : undefined}
        checked={on}
        onCheckedChange={setPenDrawsInMarkup}
      />
    </Row>
  );
}

export function KeptDocumentsRow({
  onPush,
  hint,
}: {
  readonly onPush: (page: SettingsPageId) => void;
  readonly hint?: string | undefined;
}) {
  const keeping = useSessionStore((s) => s.keeping);
  const items = useSessionStore((s) => s.items);
  const total = useSessionStore((s) => s.totalBytes);
  const locale = useLocale();
  const value =
    keeping === 'unavailable'
      ? m.session_not_kept()
      : items.length === 0
        ? m.settings_kept_none()
        : `${formatNumber(items.length)} · ${formatFileSize(total, locale)}`;
  return (
    <NavRow
      id="keptDocuments"
      label={m.settings_kept_documents()}
      value={value}
      hint={hint}
      onPress={() => onPush('kept')}
    />
  );
}

export function RecentsRow() {
  const count = useRecentsStore((s) => s.entries.length);
  return (
    <Row id="recents" bar>
      <Line
        label={m.settings_recents()}
        value={count === 0 ? m.settings_recents_none() : m.settings_recents_count({ count })}
      >
        <Button
          variant="standard"
          disabled={count === 0}
          aria-label={m.recents_clear()}
          onClick={() => void commandRegistry.execute('file.clearRecents')}
        >
          {m.settings_clear()}
        </Button>
      </Line>
    </Row>
  );
}

export function CommentNameRow() {
  const author = useAnnotationStore((s) => s.author);
  const setAuthor = useAnnotationStore((s) => s.setAuthor);
  const hintId = useId();
  return (
    // The row's one shape: name and hint leading, the field trailing; the field keeps its own
    // label (for assistive technology) and is described by the hint. A labelled field, not a
    // bar: its well is the 32 / 44 px control (09 §12).
    <Row id="commentName">
      <Line
        label={m.settings_comment_name()}
        labelHidden
        description={m.settings_comment_name_hint()}
        descriptionId={hintId}
      >
        <TextField
          className={styles.field}
          label={m.settings_comment_name()}
          hideLabel
          aria-describedby={hintId}
          value={author}
          onValueChange={setAuthor}
          autoComplete="name"
          spellCheck={false}
          maxLength={200}
        />
      </Line>
    </Row>
  );
}

export function ShowTipsRow() {
  // The one-time hints live in the edit policy store (craft §3.5).
  const pending = useInputPolicyStore((s) => s.editTextHintShown);
  return (
    <Row id="showTips" bar>
      <Line label={m.settings_show_tips()} description={m.settings_show_tips_hint()}>
        <Button
          variant="standard"
          disabled={!pending}
          reason={pending ? undefined : m.settings_show_tips_none()}
          onClick={() => {
            if (tipsToShowAgain()) showTipsAgain();
          }}
        >
          {m.settings_show_tips_action()}
        </Button>
      </Line>
    </Row>
  );
}

export function PrivacyRow({
  onPush,
  hint,
}: {
  readonly onPush: (page: SettingsPageId) => void;
  readonly hint?: string | undefined;
}) {
  const { count } = useExternalRequests();
  return (
    <NavRow
      id="privacy"
      icon={<Icon name="shield-check" className={styles.icon} />}
      label={m.settings_section_privacy()}
      value={count === 0 ? m.settings_privacy_clean() : m.settings_privacy_external({ count })}
      hint={hint}
      onPress={() => onPush('privacy')}
    />
  );
}

export function ShortcutsRow() {
  return (
    <NavRow
      id="shortcuts"
      icon={<Icon name="keyboard" className={styles.icon} />}
      label={m.keyboard_shortcuts()}
      // S22 is its own sheet; opening it replaces Settings (07 §1.1 rule 1).
      onPress={() => useUiStore.getState().setShortcutsOpen(true)}
    />
  );
}

export function AboutRow({
  onPush,
  hint,
}: {
  readonly onPush: (page: SettingsPageId) => void;
  readonly hint?: string | undefined;
}) {
  return (
    <NavRow
      id="about"
      icon={<Icon name="info" className={styles.icon} />}
      label={m.about_command({ name: PRODUCT_NAME })}
      // The version is literal text: its hyphens neither spaced nor raised (see pages.tsx).
      value={
        <span className={styles.literal}>
          {BUILD_INFO.isPreRelease
            ? m.settings_about_value({ version: BUILD_INFO.version })
            : BUILD_INFO.version}
        </span>
      }
      hint={hint}
      onPress={() => onPush('about')}
    />
  );
}

/** Rows of the main list, by id (a row inside a page renders there, not here). */
export type MainRowId = Exclude<
  SettingsRowId,
  | 'privacyRequests'
  | 'privacyOffline'
  | 'aboutVersion'
  | 'aboutCommit'
  | 'aboutBuildDate'
  | 'aboutReleaseNotes'
  | 'aboutLicence'
  | 'aboutSource'
  | 'aboutStorage'
  | 'aboutOffline'
  | 'aboutPage'
>;
