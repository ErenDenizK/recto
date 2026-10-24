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
  const font = `500 ${FONT_PT * SCALE}px Inter, Helvetica, Arial, sans-serif`;
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

/** The focused field when it is an empty text field of the active document, else undefined. */
function emptyTextField() {
  const active = useFormStore.getState().active;
  if (active === null) return undefined;
  const stop = activeStops().find(
    (s) =>
      s.source === active.source &&
      s.fieldId === active.fieldId &&
      s.name === active.name &&
      s.widget === active.widget &&
      s.pageId === active.pageId,
  );
  const empty = stop?.field.kind === 'text' && (stop.field.value ?? '') === '';
  return empty ? active : undefined;
}

/** Date's press: fills the focused empty text field, else arms the date for a click on the page. */
export async function putDate(date: Date = new Date()): Promise<void> {
  const text = dateText(date);
  const field = emptyTextField();
  if (field !== undefined) {
    await commitFieldValue(field, text);
    return;
  }
  const { blob, width, height } = await dateImage(text);
  useAnnotationStore.getState().setPendingStamp({ kind: 'image', blob, width, height });
  // The stamp tool arms through its own command path (Markup is open: no other effect).
  if (useToolStore.getState().mode !== 'stamp') await activateTool(toolDefinition('stamp'));
  announce(m.annot_place_stamp());
}
