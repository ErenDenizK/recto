/**
 * The Fill & sign bar's Date (DSN-75): today's date in the locale's numeric form ("24/10/2026"
 * en-GB, "24.10.2026" tr), put where it is wanted by the same paths as everything else.
 *
 * - **A text field is focused and empty:** it is filled (`commitFieldValue`, one history entry
 *   "Fill <name>"), as typing it would.
 * - **Otherwise:** the date is armed as a one-shot image stamp (`pendingStamp`, `stamp` tool),
 *   so a click on the page places it, with the placing, selection and Esc of every stamp. A
 *   date placed this way is an image, not editable text: a known limit of the prototype.
 */
import { useAnnotationStore } from '../annotations/annotation-store';
import { activateTool } from '../annotations/commands';
import { toolDefinition } from '../annotations/tools';
import { commitFieldValue } from '../forms/actions';
import { useFormStore } from '../forms/form-store';
import { activeStops } from '../forms/navigation';
import { getLocale, m } from '../i18n';
import { announce } from '../shell/announcer';
import { useToolStore } from '../viewer/tool-store';
import { INK } from '../annotations/palette';
import { commitOpenFieldEditor } from '../forms/FieldEditors';
import { fieldIndex } from './SignGroup';

/** `date` as the locale writes it in numerals, day first for English (en-GB) as `formatDay`. */
export function dateText(date: Date, locale: string = getLocale()): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Pixels per point of the drawn date. */
const SCALE = 4;
/** The date's size on the page (pt). */
const FONT_PT = 12;

/** `text` drawn as a transparent PNG; width and height are the placed size basis in points. */
async function dateImage(text: string) {
  const font = `500 ${FONT_PT * SCALE}px 'Inter Recto', Helvetica, Arial, sans-serif`;
  const probe = new OffscreenCanvas(1, 1).getContext('2d');
  if (!probe) throw new Error('No 2D context for the date');
  probe.font = font;
  const pad = 4 * SCALE;
  const width = Math.ceil(probe.measureText(text).width) + 2 * pad;
  const height = Math.round(FONT_PT * SCALE * 1.5);
  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('No 2D context for the date');
  g.font = font;
  g.fillStyle = INK.black;
  g.textBaseline = 'middle';
  g.fillText(text, pad, height / 2);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { blob, width: width / SCALE, height: height / SCALE };
}

/** The image of the date stamp armed last, to tell it from any other image stamp. */
let dateBlob: Blob | null = null;

/** Whether `pending` is the date stamp this module armed. */
export function isDateStamp(pending: { readonly blob?: Blob | undefined } | null): boolean {
  return pending?.blob !== undefined && pending.blob === dateBlob;
}

/**
 * The focused field when it is an empty text field of the active document, else undefined.
 * An open editor is what the user sees, so its typed text decides, not the stored value.
 */
function emptyTextField() {
  const active = useFormStore.getState().active;
  if (active === null) return undefined;
  const stops = activeStops();
  const stop = stops[fieldIndex(stops, active)];
  if (stop?.field.kind !== 'text') return undefined;
  const editor = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    '[data-form-editor]',
  );
  const shown = editor ? editor.value : (stop.field.value ?? '');
  return shown === '' ? active : undefined;
}

/** Date's press: fills the focused empty text field, else arms the date for a click on the page. */
export async function putDate(date: Date = new Date()): Promise<void> {
  const text = dateText(date);
  const field = emptyTextField();
  // Typed text is committed, never overwritten (and never lost to a later blur).
  commitOpenFieldEditor();
  if (field !== undefined) {
    // Close the editor: it holds '' and would overwrite the date when it next commits.
    useFormStore.getState().setActive(null);
    await commitFieldValue(field, text);
    return;
  }
  const { blob, width, height } = await dateImage(text);
  dateBlob = blob;
  useAnnotationStore.getState().setPendingStamp({ kind: 'image', blob, width, height });
  // The stamp tool arms through its own command path (Markup is open: no other effect).
  if (useToolStore.getState().mode !== 'stamp') await activateTool(toolDefinition('stamp'));
  announce(m.annot_place_stamp());
}
