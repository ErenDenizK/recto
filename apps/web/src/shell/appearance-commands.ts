/**
 * Palette commands for the appearance settings (language.md §2.8, §7.6; spec D3-3, D3-4):
 * "Glass: Clear", "Glass: Tinted" and "Glass: Solid" set the Glass setting (as the language
 * commands set the language) and say it; "Reduce motion" switches between System and On and
 * says the new state, its title carrying the current one ("Reduce motion: System"). The
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
  useAppearanceStore,
} from '../state/appearance-store';
import { announce } from './announcer';

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

/** Found in either UI language, as the language commands are. */
const SHARED_KEYWORDS = ['appearance', 'settings', 'görünüm', 'görünüş', 'ayarlar'] as const;

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
 * Registers the four commands and registers them again whenever Reduce motion changes, so its
 * title always says the current value.
 */
export function registerAppearanceCommands(registry: CommandRegistry): () => void {
  let disposers: (() => void)[] = [];
  const register = () => {
    for (const dispose of disposers) dispose();
    const { motion } = useAppearanceStore.getState();
    disposers = [
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
    ];
  };
  register();
  const unsubscribe = useAppearanceStore.subscribe((state, previous) => {
    if (state.motion !== previous.motion) register();
  });
  return () => {
    unsubscribe();
    for (const dispose of disposers) dispose();
    disposers = [];
  };
}
