import { useEffect } from 'react';

import { type CommandRegistry, commandRegistry } from './registry';
import { currentPlatform, matchShortcut, type Platform } from './shortcuts';

/** True for targets where plain keys are text input, not commands. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit', 'color', 'file'].includes(
      target.type,
    );
  }
  return false;
}

/**
 * The app's Ctrl/⌘ shortcuts that run from inside a text field outside a dialog (INK-12): Save,
 * Save a copy, Settings, the command bar, Find and Open (Print joins when it exists, Epic 5).
 * Every other key stays the field's or the browser's; a command can still opt in everywhere,
 * dialogs included (`allowInInputs`).
 */
export const FIELD_SHORTCUTS: ReadonlySet<string> = new Set([
  'file.save',
  'file.export',
  'settings.open',
  'view.palette',
  'search.open',
  'file.open',
]);

/**
 * Whether a text field keeps `event` as text: any key without Ctrl or ⌘, and any key typed
 * with AltGr, which Windows reports as Ctrl+Alt (Turkish AltGr+Q types @).
 */
export function fieldKeepsKey(event: KeyboardEvent): boolean {
  if (event.getModifierState('AltGraph')) return true;
  return !event.ctrlKey && !event.metaKey;
}

function isInsideModal(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[aria-modal="true"]') !== null;
}

function runSafely(id: string, run: () => void | Promise<void>): void {
  const report = (error: unknown) => {
    console.error(`Command "${id}" failed`, error);
  };
  try {
    const result = run();
    if (result instanceof Promise) result.catch(report);
  } catch (error) {
    report(error);
  }
}

/**
 * Handles a keydown against the registry. Exported for tests and for surfaces that need
 * to forward keys (e.g. an iframe) without a window listener.
 */
export function dispatchShortcut(
  event: KeyboardEvent,
  registry: CommandRegistry = commandRegistry,
  platform: Platform = currentPlatform,
): boolean {
  if (event.defaultPrevented || event.isComposing || event.key === 'Process') return false;
  const modal = isInsideModal(event.target);
  const editable = isEditableTarget(event.target);
  // In a field outside a dialog, the allowlisted Ctrl/⌘ shortcuts are the app's too (INK-12).
  const fieldGives = editable && !modal && !fieldKeepsKey(event);
  for (const command of registry.list()) {
    if ((modal || editable) && !command.allowInInputs) {
      if (!fieldGives || !FIELD_SHORTCUTS.has(command.id)) continue;
    }
    if (!command.shortcuts.some((s) => matchShortcut(event, s, platform))) continue;
    if (!registry.isEnabled(command)) continue;
    event.preventDefault();
    // Run synchronously: some commands (file pickers) need the keydown's user activation.
    runSafely(command.id, command.run);
    return true;
  }
  return false;
}

/**
 * Installs the global shortcut listener. Mount once, at the shell root. Listens in the
 * bubble phase so focused widgets (tab lists, tool bars, dialogs) handle their own keys
 * first and can claim them with `preventDefault()`.
 */
export function useShortcuts(registry: CommandRegistry = commandRegistry): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      dispatchShortcut(event, registry);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [registry]);
}
