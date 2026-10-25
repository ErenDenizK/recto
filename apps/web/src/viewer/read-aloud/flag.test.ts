import { expect, it } from 'vitest';

// The flag is read once when `flag.ts` first loads, so the address and the speech engine are set
// before any import of it (each test file has its own module graph).
it('with ?read=1 and a speaking browser the command is registered, bound and listed', async () => {
  window.history.replaceState(null, '', '/?read=1');
  Object.defineProperty(window, 'speechSynthesis', { value: {}, configurable: true });
  const { CommandRegistry } = await import('../../commands/registry');
  const { KEYMAP_ENTRIES } = await import('../../commands/keymap');
  const { registerViewerCommands } = await import('../viewer-commands');
  const registry = new CommandRegistry();
  const dispose = registerViewerCommands(registry);
  const command = registry.get('view.readAloud');
  expect(command?.shortcuts).toHaveLength(1);
  expect(KEYMAP_ENTRIES['view.readAloud']).toEqual({ group: 'view' });
  dispose();
  window.history.replaceState(null, '', '/');
});
