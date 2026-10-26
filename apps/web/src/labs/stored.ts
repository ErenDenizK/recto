/**
 * What the Labs panel keeps (DSN-82): one `localStorage` key holding the panel's reveal and the
 * owner's toggles, `{ shown, flags: { [labs key]: value } }`. This is the only part of Labs the
 * flag readers import, so it stays tiny; the registry, the panel and the store load with
 * Settings (Q-11).
 *
 * A flag's resolution order is: the address (`?param=…`), then the Labs toggle, then what the
 * flag kept on its own before Labs existed (`stored` in each reader), then its default.
 */
export const LABS_KEY = 'pdf-editor:labs:v1';

export interface LabsState {
  readonly shown: boolean;
  readonly flags: Readonly<Record<string, string>>;
}

/** The kept state; storage that is blocked or holds something else reads as nothing set. */
export function readLabs(): LabsState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LABS_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return { shown: false, flags: {} };
    const { shown, flags } = parsed as { shown?: unknown; flags?: unknown };
    const kept: Record<string, string> = {};
    if (typeof flags === 'object' && flags !== null) {
      for (const [key, value] of Object.entries(flags)) {
        if (typeof value === 'string') kept[key] = value;
      }
    }
    return { shown: shown === true, flags: kept };
  } catch {
    return { shown: false, flags: {} };
  }
}

/** A flag reader's `stored` input: the Labs toggle of `key` if set, else what it kept itself. */
export function labsStored(key: string, own: string | null): string | null {
  return readLabs().flags[key] ?? own;
}
