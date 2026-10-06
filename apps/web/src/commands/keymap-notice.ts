/**
 * The `1` migration toast (flows §7.3): in M8 `1` switched to Read, which locked the
 * document; in M9 it returns to viewing and never locks. The first press on a device that
 * used M8 says so once: "1 now returns to viewing. To lock a document, use Lock in its title
 * menu." A device that never ran M8 has nothing to unlearn and is told nothing.
 *
 * M8's use is read from the records it left (they stay where they are after their migration,
 * `ui-store.ts` `loadLayout`, `input-policy-store.ts`): the panel layout `ui:v2` or `ui:v1`,
 * the edit policy `edit-policy:v1`. Once said, `keymap-notice:v1` keeps it said.
 */
import { m } from '../i18n';
import { LEGACY_EDIT_POLICY_STORAGE_KEY } from '../state/input-policy-store';
import { readJson, writeJson } from '../state/safe-storage';
import { LEGACY_LAYOUT_STORAGE_KEY, V2_LAYOUT_STORAGE_KEY } from '../state/ui-store';
import { toast } from '../ui/Toast/toast';

export const KEYMAP_NOTICE_STORAGE_KEY = 'pdf-editor:keymap-notice:v1';

/** Records M8 wrote and M9 only reads: their presence means the device ran M8. */
const M8_RECORDS = [
  V2_LAYOUT_STORAGE_KEY,
  LEGACY_LAYOUT_STORAGE_KEY,
  LEGACY_EDIT_POLICY_STORAGE_KEY,
] as const;

/** Whether this device ran M8, where `1` locked. */
function usedM8(): boolean {
  return M8_RECORDS.some((key) => readJson(key) !== undefined);
}

/** On a `1`: the one-time toast, on a device that used M8 and has not been told. */
export function noteKeyOneChanged(): void {
  if (readJson(KEYMAP_NOTICE_STORAGE_KEY) === true || !usedM8()) return;
  writeJson(KEYMAP_NOTICE_STORAGE_KEY, true);
  toast.info(m.keymap_notice_key_one(), { key: 'keymap-notice', testId: 'keymap-notice' });
}
