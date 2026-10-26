/**
 * The single capsule's state rules (EDN-24, Labs `phone-capsule`; plan "State transitions"):
 * which tool the capsule shows pressed, what a tap on a tool does, and the one subscription that
 * opens the tray when a tool goes from off to on. The pure table is apart from the store calls
 * (`tapCapsuleTool`) so it is tested alone. With the switch off nothing here runs.
 */
import { type CompactTool, setTrayOpen, useCompactStore } from '../compact-store';
import { armTool, eraserFrom, toolOff } from './bridge';

/** What a tap on a capsule tool does: arm it, turn the tool off, or open its tray. */
export type CapsuleTap = 'arm' | 'off' | 'open';

/**
 * The capsule tool that shows pressed for the armed `tool`: the Eraser counts as the tool it
 * took over from (`from`), Edit text as Text; the tool off presses nothing.
 */
export function trayTool(tool: CompactTool | null, from: CompactTool): CompactTool | null {
  if (tool === 'eraser') return from;
  if (tool === 'edit-text') return 'text';
  return tool;
}

/**
 * The armed-tool tap (EDN-24, the owner's taste point; swap the rule here): tapping a tool arms
 * it; tapping the pressed one turns the tool off while its tray is open and opens the tray while
 * it is closed. From the Eraser, the tool it took over from arms again (back from the Eraser).
 */
export function tapRule(
  tool: CompactTool | null,
  pressed: CompactTool | null,
  id: CompactTool,
  trayOpen: boolean,
): CapsuleTap {
  if (tool === null || pressed !== id || tool === 'eraser') return 'arm';
  return trayOpen ? 'off' : 'open';
}

/** A tap on the capsule's tool `id`: the rule above, through the bridge and the store. */
export function tapCapsuleTool(id: CompactTool): void {
  const { editing, tool, trayOpen } = useCompactStore.getState();
  if (!editing) return;
  const action = tapRule(tool, trayTool(tool, eraserFrom()), id, trayOpen);
  if (action === 'off') {
    toolOff();
    setTrayOpen(false);
    return;
  }
  if (action === 'arm') {
    armTool(id);
    // A soon tool does not arm; no tool, no tray.
    if (useCompactStore.getState().tool === null) return;
  }
  setTrayOpen(true);
}

/**
 * Opens the tray whenever the tool goes from off to on while editing (a signature field enters
 * editing with Sign armed, the selection bar's Edit text arms Edit text). Installed by the
 * capsule's tool row only; returns the disposer.
 */
export function installTrayOpener(): () => void {
  return useCompactStore.subscribe((state, previous) => {
    if (state.editing && previous.tool === null && state.tool !== null) setTrayOpen(true);
  });
}
