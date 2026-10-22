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

/** Keys that, with Ctrl or ⌘, edit a field's text or move its caret (select all, undo…). */
const FIELD_KEYS = new Set([
  'a',
  'c',
  'v',
  'x',
  'z',
  'y',
  'arrowleft',
  'arrowright',
  'arrowup',
  'arrowdown',
  'home',
  'end',
  'pageup',
  'pagedown',
  'backspace',
  'delete',
]);
/** Bold, italic and underline, which a rich text field (contenteditable) keeps as well. */
const RICH_TEXT_KEYS = new Set(['b', 'i', 'u']);

/**
 * Whether a text field keeps `event` as text (INK-12): a key without Ctrl or ⌘ (a letter,
 * Shift, Alt, which types characters on macOS) and the Ctrl or ⌘ keys that edit text or move
 * the caret. Any other Ctrl or ⌘ key cannot mean text, so the app's shortcut runs from the
 * field (Save a copy, Settings, Zoom).
 */
export function fieldKeepsKey(event: KeyboardEvent): boolean {
  if (!event.ctrlKey && !event.metaKey) return true;
  const key = event.key.toLowerCase();
  if (FIELD_KEYS.has(key)) return true;
  return (
    event.target instanceof HTMLElement && event.target.isContentEditable && RICH_TEXT_KEYS.has(key)
  );
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
  // In a field (outside a dialog) a Ctrl or ⌘ key the field does not keep is the app's.
  const modal = isInsideModal(event.target);
  const editable = isEditableTarget(event.target);
  const guarded = modal || (editable && fieldKeepsKey(event));
  for (const command of registry.list()) {
    if (guarded && !command.allowInInputs) continue;
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
