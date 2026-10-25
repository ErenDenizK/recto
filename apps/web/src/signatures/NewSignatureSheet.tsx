/**
 * S7, New signature (components/07-sheets.md §9, 07.5; 03-markup.md MK-13; flows.md J8A; spec
 * redesign D0-11). It replaces the old signature dialog (`annotations/SignatureDialog.tsx`,
 * session-only), keeping its drawing and typing code: draw, type or pick a signature, keep it
 * on this device, and arm it.
 *
 * - **Presentation** (`ui/sheet/presentation.ts`, kind `signature`): a centred 520 px dialog on
 *   a fine pointer (the pad needs width, not height), a side sheet on a coarse one from the
 *   expanded class up, a form sheet on medium, a full sheet on compact-height and a bottom
 *   sheet at 92 % on a compact window; the phone edition shows the same form in its own sheet
 *   (DSN-53, `new-signature-form.tsx`). A press on the pad never swipes the sheet
 *   (`data-sheet-no-swipe`); only the grabber does.
 * - **Draw · Type · Image** (a tabs segmented control). Draw: the 440 × 160 pad, page white,
 *   pen, finger and mouse alike (whatever "Draw with finger" says), with Undo (the last stroke)
 *   and Clear; strokes are kept as vectors (`saved-signatures.ts`). Type: "Your name", the
 *   comment author's name to start, previewed in Inter's italic at a light weight as the placed
 *   image draws it (`annotations/stamps.ts`; no script font is bundled, MK-13 §6). Image: the
 *   empty well is itself "Choose image…", a PNG or JPEG (anything the browser reads is
 *   re-encoded), previewed, with "Choose image…" under it to pick another.
 * - **One size** (quality-bar Q-7): the three panels are stacked in one cell and kept mounted,
 *   so the body is as tall as the tallest whichever tab shows, and the reason line keeps its
 *   room while Use is enabled: neither switching tabs nor the first stroke moves the sheet.
 * - **Save for next time**, on by default; with five kept it says it replaces the oldest; where
 *   this window keeps nothing it is off and says so. With it on, an optional name.
 * - **Use signature** keeps it (if asked), arms it as the one-shot signature tool and closes:
 *   the next click or drag on a page places it (MK-13 §6). The signature shrinks from the pad
 *   into its new chip (or the Sign button), which takes a receive pulse (`flight.ts`). Disabled until there is something to
 *   use, with the reason (RA-21). Opened from Settings (`keep`), the primary is **Save
 *   signature**, it always keeps, and closing returns to Settings → Saved signatures.
 * - **Drafts** (07 §1.1 rule 5): what was drawn, typed or picked stays for the session through
 *   Esc, ✕ or the scrim, and is reset once it is used.
 * - **Accessibility** (MK-13 §8): the pad is `role="img"` with a live "Signature drawn, 3
 *   strokes"; Type is the keyboard path (Tab to the field, type, Enter uses it).
 */
import { Sheet } from '../ui/sheet/Sheet';
import { NEW_SIGNATURE_SHEET_ID } from './new-signature';
import { useNewSignatureForm } from './new-signature-form';

export default function NewSignatureSheet() {
  const form = useNewSignatureForm({ hint: true });
  return (
    <Sheet
      id={NEW_SIGNATURE_SHEET_ID}
      kind="signature"
      open={form.open}
      onClose={form.close}
      title={form.title}
      description={form.description}
      restored={form.restored}
      primary={form.primary}
      initialFocus={form.initialFocus}
      testId="new-signature-sheet"
    >
      {form.body}
    </Sheet>
  );
}
