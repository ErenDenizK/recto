/**
 * Palette commands for the appearance settings (spec craft §7): "Glass panels" and "Reduce
 * transparency" toggle and say the new state; their titles carry the current one ("Glass
 * panels: off"). "Reduce motion" (language.md §7.6; spec D3-4) switches between System and On
 * the same way ("Reduce motion: System"). The Settings sheet's Appearance rows
 * (components/07-sheets.md S3; spec redesign D0-10) set the same values through the same
 * setters, and "Appearance settings…"
 * (`settings/settings-commands.ts`) opens the sheet there: the Document menu's Appearance
 * submenu is gone (07 §25), and these commands stay so every setting is one ⌘K away.
 */
import type { CommandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { type MotionSetting, useAppearanceStore } from '../state/appearance-store';
import { announce } from './announcer';

/** Turns Glass panels on or off and announces it. */
export function setGlassPanels(on: boolean): void {
  useAppearanceStore.getState().setGlassPanels(on);
  announce(on ? m.announce_glass_panels_on() : m.announce_glass_panels_off());
}

/** Turns Reduce transparency on or off and announces it. */
export function setReduceTransparency(on: boolean): void {
  useAppearanceStore.getState().setReduceTransparency(on);
  announce(on ? m.announce_reduce_transparency_on() : m.announce_reduce_transparency_off());
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

/**
 * Registers the three commands, titled with the current state ("Glass panels: off", review
 * F21), and registers them again whenever a setting changes so the palette always says it.
 */
export function registerAppearanceCommands(registry: CommandRegistry): () => void {
  let disposers: (() => void)[] = [];
  const register = () => {
    for (const dispose of disposers) dispose();
    const { glassPanels, reduceTransparency, motion } = useAppearanceStore.getState();
    disposers = [
      registry.register({
        id: 'view.glassPanels',
        title: glassPanels ? m.cmd_view_glass_panels_on() : m.cmd_view_glass_panels_off(),
        group: m.group_view(),
        act: null,
        keywords: [
          ...SHARED_KEYWORDS,
          'glass',
          'frosted',
          'blur',
          'panels',
          'toggle',
          'cam',
          'buzlu',
        ],
        run: () => setGlassPanels(!useAppearanceStore.getState().glassPanels),
      }),
      registry.register({
        id: 'view.reduceTransparency',
        title: reduceTransparency
          ? m.cmd_view_reduce_transparency_on()
          : m.cmd_view_reduce_transparency_off(),
        group: m.group_view(),
        act: null,
        keywords: [
          ...SHARED_KEYWORDS,
          'transparency',
          'opaque',
          'solid',
          'toggle',
          'saydamlık',
          'opak',
        ],
        run: () => setReduceTransparency(!useAppearanceStore.getState().reduceTransparency),
      }),
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
    if (
      state.glassPanels !== previous.glassPanels ||
      state.reduceTransparency !== previous.reduceTransparency ||
      state.motion !== previous.motion
    ) {
      register();
    }
  });
  return () => {
    unsubscribe();
    for (const dispose of disposers) dispose();
    disposers = [];
  };
}
