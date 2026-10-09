/**
 * Palette commands for the appearance settings (language.md §2.8, §7.6; ADR-0022 §2.4; spec
 * D3-3, D3-4, D3-7): "Theme: System", "Theme: Light" and "Theme: Dark" set the Theme setting and
 * say it, as the Glass ones do; "Glass: Clear", "Glass: Tinted" and "Glass: Solid" set the Glass setting (as the language
 * commands set the language) and say it; "Reduce motion" switches between System and On and
 * says the new state, its title carrying the current one ("Reduce motion: System");
 * "Background glow" (G5) does the same for the aura behind the reader. The
 * Settings sheet's Appearance rows (components/07-sheets.md S3; spec redesign D0-10) set the
 * same values through the same setters, and "Appearance settings…"
 * (`settings/settings-commands.ts`) opens the sheet there: the Document menu's Appearance
 * submenu is gone (07 §25), and these commands stay so every setting is one ⌘K away.
 */
import type { CommandRegistry } from '../commands/registry';
import { m } from '../i18n';
import {
  type GlassSetting,
  type MotionSetting,
  type ThemeSetting,
  useAppearanceStore,
} from '../state/appearance-store';
import { announce } from './announcer';

/** Each Theme value's command title, which is also what it announces. */
const THEME_TITLE: Record<ThemeSetting, () => string> = {
  system: () => m.cmd_view_theme_system(),
  light: () => m.cmd_view_theme_light(),
  dark: () => m.cmd_view_theme_dark(),
};

/** Sets Theme and announces it ("Theme: Light"). */
export function setTheme(theme: ThemeSetting): void {
  useAppearanceStore.getState().setTheme(theme);
  announce(THEME_TITLE[theme]());
}

/** Each Glass value's command title, which is also what it announces. */
const GLASS_TITLE: Record<GlassSetting, () => string> = {
  clear: () => m.cmd_view_glass_clear(),
  tinted: () => m.cmd_view_glass_tinted(),
  solid: () => m.cmd_view_glass_solid(),
};

/** Sets Glass and announces it ("Glass: Tinted"). */
export function setGlass(glass: GlassSetting): void {
  useAppearanceStore.getState().setGlass(glass);
  announce(GLASS_TITLE[glass]());
}

/** Sets Reduce motion to System or On and announces it. */
export function setMotion(motion: MotionSetting): void {
  useAppearanceStore.getState().setMotion(motion);
  announce(
    motion === 'reduced' ? m.announce_reduce_motion_on() : m.announce_reduce_motion_system(),
  );
}

/** Turns Background glow on or off (G5) and announces it. */
export function setGlow(glow: boolean): void {
  useAppearanceStore.getState().setGlow(glow);
  announce(glow ? m.announce_glow_on() : m.announce_glow_off());
}

/** Found in either UI language, as the language commands are. */
const SHARED_KEYWORDS = ['appearance', 'settings', 'görünüm', 'görünüş', 'ayarlar'] as const;

/** Every Theme command, in both languages, and the value's own words. */
const THEME_KEYWORDS = [...SHARED_KEYWORDS, 'theme', 'mode', 'tema', 'mod'] as const;

const THEME_VALUE_KEYWORDS: Record<ThemeSetting, readonly string[]> = {
  system: ['system', 'auto', 'automatic', 'device', 'sistem', 'otomatik', 'cihaz'],
  light: ['light', 'light mode', 'day', 'açık', 'aydınlık', 'gündüz'],
  dark: ['dark', 'dark mode', 'night', 'koyu', 'karanlık', 'gece'],
};

/** Every Glass command: transparency and its Turkish words, and the value's own. */
const GLASS_KEYWORDS = [
  ...SHARED_KEYWORDS,
  'glass',
  'transparency',
  'frosted',
  'blur',
  'cam',
  'saydamlık',
  'buzlu',
] as const;

const GLASS_VALUE_KEYWORDS: Record<GlassSetting, readonly string[]> = {
  clear: ['clear', 'saydam'],
  tinted: ['tinted', 'translucent', 'yarı saydam'],
  solid: ['solid', 'opaque', 'reduce transparency', 'opak'],
};

/**
 * Registers the eight commands and registers them again whenever Reduce motion or Background
 * glow changes, so their titles always say the current value.
 */
export function registerAppearanceCommands(registry: CommandRegistry): () => void {
  let disposers: (() => void)[] = [];
  const register = () => {
    for (const dispose of disposers) dispose();
    const { motion, glow } = useAppearanceStore.getState();
    disposers = [
      ...(['system', 'light', 'dark'] as const).map((theme) =>
        registry.register({
          id: `view.theme.${theme}`,
          title: THEME_TITLE[theme](),
          group: m.group_view(),
          act: null,
          keywords: [...THEME_KEYWORDS, ...THEME_VALUE_KEYWORDS[theme]],
          run: () => setTheme(theme),
        }),
      ),
      ...(['clear', 'tinted', 'solid'] as const).map((glass) =>
        registry.register({
          id: `view.glass.${glass}`,
          title: GLASS_TITLE[glass](),
          group: m.group_view(),
          act: null,
          keywords: [...GLASS_KEYWORDS, ...GLASS_VALUE_KEYWORDS[glass]],
          run: () => setGlass(glass),
        }),
      ),
      registry.register({
        id: 'view.reduceMotion',
        title:
          motion === 'reduced' ? m.cmd_view_reduce_motion_on() : m.cmd_view_reduce_motion_system(),
        group: m.group_view(),
        act: null,
        keywords: [
          ...SHARED_KEYWORDS,
          'motion',
          'animation',
          'reduce',
          'toggle',
          'hareket',
          'animasyon',
          'azalt',
        ],
        run: () =>
          setMotion(useAppearanceStore.getState().motion === 'reduced' ? 'system' : 'reduced'),
      }),
      registry.register({
        id: 'view.glow',
        title: glow ? m.cmd_view_glow_on() : m.cmd_view_glow_off(),
        group: m.group_view(),
        act: null,
        keywords: [
          ...SHARED_KEYWORDS,
          'glow',
          'aura',
          'background',
          'light',
          'toggle',
          'ışıltı',
          'arka plan',
          'hale',
          'ışık',
        ],
        run: () => setGlow(!useAppearanceStore.getState().glow),
      }),
    ];
  };
  register();
  const unsubscribe = useAppearanceStore.subscribe((state, previous) => {
    if (state.motion !== previous.motion || state.glow !== previous.glow) register();
  });
  return () => {
    unsubscribe();
    for (const dispose of disposers) dispose();
    disposers = [];
  };
}
