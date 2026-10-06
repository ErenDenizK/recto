/**
 * The pointer policy's shared state (craft spec §3.5; 05-canvas §6): the pointer log the page
 * layers consult (`hit-order.ts`), the first pen sighting that turns "Pen draws in Markup"
 * on, the first-pen hint in viewing (`pen-hint.ts`), the Space pan, and the palette command
 * "Toggle pen draws in Edit". Importing this module installs the window listeners once.
 */
import { penSession } from '../annotations/pen/ink-input';
import type { CommandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { penDrawsInMarkup, useInputPolicyStore } from '../state/input-policy-store';
import { createPointerLog, watchPointers } from './hit-order';
import { installPenHint } from './pen-hint';
import { installSpacePan } from './space-pan';

/** The page's pointer log (last press type, last pen lift). */
export const pointerLog = createPointerLog();

/** A pen was seen (hovering or touching): fingers pan from now on, and "auto" turns on. */
export function notePenSeen(): void {
  penSession().penSeen = true;
  useInputPolicyStore.getState().notePen();
}

/** Whether a pen draws with Select armed, now. */
export function penDrawsNow(): boolean {
  return penDrawsInMarkup(useInputPolicyStore.getState(), penSession().penSeen);
}

/**
 * The same as a hook, false unless `relevant` (the caller's tool is Select): a layer with
 * the pen armed does not re-render when the first pen sighting turns "auto" on mid-stroke.
 */
export function usePenDrawsInMarkup(relevant = true): boolean {
  return useInputPolicyStore((s) => relevant && penDrawsInMarkup(s, penSession().penSeen));
}

/** Turns "Pen draws in Edit" on or off and says so. */
export function setPenDrawsInMarkup(on: boolean): void {
  useInputPolicyStore.getState().setPenDrawsInMarkup(on);
  announce(on ? m.announce_pen_draws_in_edit_on() : m.announce_pen_draws_in_edit_off());
}

export function registerEditPolicyCommands(registry: CommandRegistry): () => void {
  return registry.register({
    id: 'view.penDrawsInEdit',
    title: m.cmd_view_pen_draws_in_edit(),
    group: m.group_view(),
    act: null,
    keywords: ['pen', 'stylus', 'draw', 'select', 'kalem', 'çiz', 'settings', 'ayarlar'],
    run: () => setPenDrawsInMarkup(!penDrawsNow()),
  });
}

let installed = false;

/** Installs the window listeners (pointer log, pen sighting, pen hint, Space pan) once. */
export function installEditPolicy(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  watchPointers(window, pointerLog, notePenSeen);
  installPenHint(window);
  installSpacePan(window);
}

installEditPolicy();
