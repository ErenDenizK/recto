/**
 * S7, New signature (components/07-sheets.md §9, 07.5; 03-markup.md MK-13; flows.md J8A; spec
 * redesign D0-11). It replaces the old signature dialog (`annotations/SignatureDialog.tsx`,
 * session-only), keeping its drawing and typing code: draw, type or pick a signature, keep it
 * on this device, and arm it.
 *
 * - **Presentation** (`ui/sheet/presentation.ts`, kind `signature`): a centred 520 px dialog on
 *   a fine pointer (the pad needs width, not height), a side sheet on a coarse one from the
 *   expanded class up, a form sheet on medium, a full sheet on compact-height and a bottom
 *   sheet at 92 % on a compact window. A press on the pad never swipes the sheet
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
import { type PointerEvent, useEffect, useId, useRef, useState } from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import { pickFiles } from '../files/open-files';
import { m } from '../i18n';
import { openSettings } from '../settings/open-settings';
import { Icon } from '../ui/Icon';
import { canChangeActive } from '../viewer/input-state';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Segmented, SegmentedPanel } from '../ui/Segmented';
import {
  closeSheet,
  Sheet,
  type SheetCloseReason,
  useSheetDraft,
  useSheetOpen,
  useSheetStore,
} from '../ui/sheet';
import { TextField } from '../ui/TextField';
import { toast } from '../ui/Toast';
import { flyIntoChip } from './flight';
import { imageInk } from './image-ink';
import { intentOf, NEW_SIGNATURE_SHEET_ID } from './new-signature';
import styles from './NewSignatureSheet.module.css';
import {
  armSignatureStamp,
  drawnInk,
  loadSavedSignatures,
  NAME_MAX,
  PAD_HEIGHT,
  PAD_WIDTH,
  renderInk,
  SAVED_SIGNATURE_LIMIT,
  SIGNATURE_INK,
  type SignatureInk,
  saveSignature,
  stampOfSignature,
  TYPED_MAX,
  useSavedSignatures,
} from './saved-signatures';
import { SignaturePlate } from './SignaturePlate';
import { traceSmooth } from './smooth-ink';

type Tab = 'draw' | 'type' | 'image';
interface Point {
  readonly x: number;
  readonly y: number;
}
type Stroke = readonly Point[];

interface Draft {
  readonly tab: Tab;
  readonly strokes: readonly Stroke[];
  /** Null until the person types: the comment author's name stands in. */
  readonly typed: string | null;
  readonly image: SignatureInk | null;
  readonly keep: boolean;
  readonly name: string;
}

const INITIAL: Draft = { tab: 'draw', strokes: [], typed: null, image: null, keep: true, name: '' };

/** The pad's line, in pad units (as the placed image draws it). */
const LINE_WIDTH = 2.5;

export default function NewSignatureSheet() {
  const open = useSheetOpen(NEW_SIGNATURE_SHEET_ID);
  // Held while the sheet animates out, so the footer keeps its label.
  const [intent, setIntent] = useState(() => intentOf(open?.preset ?? null));
  const asked = open ? intentOf(open.preset) : intent;
  if (asked !== intent) setIntent(asked);
  const [draft, setDraft, resetDraft, restored] = useSheetDraft<Draft>(
    NEW_SIGNATURE_SHEET_ID,
    null,
    INITIAL,
  );
  const author = useAnnotationStore((s) => s.author);
  const status = useSavedSignatures((s) => s.status);
  const kept = useSavedSignatures((s) => s.signatures.length);
  const [busy, setBusy] = useState(false);
  // Focus starts on the chosen tab (07 §2.6), not on the optional name further down.
  const focusRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const imageHintId = useId();

  useEffect(() => {
    void loadSavedSignatures();
  }, []);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const typed = (draft.typed ?? author).slice(0, TYPED_MAX);
  const keeping = intent === 'keep' || draft.keep;
  const canKeep = status !== 'refused';

  const ink: SignatureInk | null =
    draft.tab === 'draw'
      ? draft.strokes.length > 0
        ? drawnInk(draft.strokes)
        : null
      : draft.tab === 'type'
        ? typed.trim() !== ''
          ? { kind: 'typed', text: typed.trim() }
          : null
        : draft.image;

  const close = (reason: SheetCloseReason) => {
    closeSheet(NEW_SIGNATURE_SHEET_ID);
    // From Settings, back to Saved signatures, unless another sheet took the place.
    if (intent === 'keep' && reason !== 'replaced') openSettings({ row: 'savedSignatures' });
  };

  const submit = async () => {
    if (!ink || busy) return;
    // The opening this press belongs to: the store makes a new one each time the sheet opens.
    const opening = useSheetStore.getState().open;
    setBusy(true);
    try {
      const saved = keeping && canKeep ? await saveSignature(ink, draft.name) : null;
      const stamp = saved ? await stampOfSignature(saved) : await renderInk(ink);
      // Saving and rendering take a moment (longer on a slow device). If the sheet was closed
      // meanwhile (Esc) and perhaps opened again, the press is over: what it kept stays kept,
      // but it neither arms the stamp nor closes, resets or redirects a later opening.
      const now = useSheetStore.getState().open;
      if (now !== opening) {
        if (now?.id !== NEW_SIGNATURE_SHEET_ID) resetDraft();
        return;
      }
      // Where the signature is on screen as the sheet lets it go, for the flight to its chip.
      const source =
        draft.tab === 'draw'
          ? bodyRef.current?.querySelector('canvas[data-strokes]')
          : bodyRef.current?.querySelector(`[role="tabpanel"]:not([hidden]) .${styles.preview}`);
      const from = source?.getBoundingClientRect();
      resetDraft();
      close('close');
      // Arming places at a click: only in Markup, and never while locked (`place`).
      if (intent === 'use' && stamp && canChangeActive('place')) {
        armSignatureStamp(stamp);
        if (from && stamp.blob) intoChip(stamp.blob, from, saved?.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const chooseImage = async () => {
    const [file] = await pickFiles('images');
    if (!file) return;
    try {
      update({ image: await imageInk(file) });
    } catch (error) {
      console.warn('Could not read the signature image', error);
      toast.failure(m.signature_image_failed({ name: file.name }));
    }
  };

  const full = kept >= SAVED_SIGNATURE_LIMIT;
  const keepLabel = full ? m.signature_keep_full() : m.signature_keep();

  return (
    <Sheet
      id={NEW_SIGNATURE_SHEET_ID}
      kind="signature"
      open={open !== null}
      onClose={close}
      title={m.signature_new_title()}
      description={m.tool_signature_tooltip()}
      restored={restored && ink !== null}
      primary={{
        label: intent === 'keep' ? m.signature_save() : m.signature_use(),
        onPress: () => void submit(),
        disabled: ink === null,
        reason: m.signature_empty_reason(),
        // The line keeps its room while Use is enabled, so the sheet keeps its size (Q-7).
        reasonRoom: true,
        busy,
      }}
      initialFocus={focusRef}
      testId="new-signature-sheet"
    >
      <div
        className={styles.body}
        ref={(el) => {
          bodyRef.current = el;
          focusRef.current =
            el?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? null;
        }}
      >
        <Segmented
          semantics="tabs"
          label={m.signature_modes()}
          value={draft.tab}
          onValueChange={(tab) => update({ tab })}
          options={[
            { value: 'draw', label: m.signature_draw() },
            { value: 'type', label: m.signature_type() },
            { value: 'image', label: m.signature_image() },
          ]}
        >
          <div className={styles.panels}>
            <SegmentedPanel value="draw" className={styles.panel} keepMounted>
              <Pad
                strokes={draft.strokes}
                onChange={(change) => setDraft((d) => ({ ...d, strokes: change(d.strokes) }))}
              />
            </SegmentedPanel>
            <SegmentedPanel value="type" className={styles.panel} keepMounted>
              <TextField
                label={m.signature_type_label()}
                value={typed}
                maxLength={TYPED_MAX}
                autoComplete="name"
                spellCheck={false}
                onValueChange={(value) => update({ typed: value })}
              />
              <SignaturePlate
                size="preview"
                ink={{ kind: 'typed', text: typed.trim() || ' ' }}
                className={`${styles.preview} ${styles.typed}`}
              />
            </SegmentedPanel>
            <SegmentedPanel value="image" className={styles.panel} keepMounted>
              {draft.image ? (
                <>
                  <SignaturePlate
                    size="preview"
                    ink={draft.image}
                    alt={m.signature_image_chosen()}
                    className={styles.preview}
                  />
                  <div className={styles.padActions} data-bar="signature-image">
                    <Button variant="standard" onClick={() => void chooseImage()}>
                      {m.signature_choose_image()}
                    </Button>
                  </div>
                </>
              ) : (
                // The empty well is the target itself: the whole dashed area picks an image
                // (MK-13), a drop well rather than a button in a row, so it keeps its own shape.
                <button
                  type="button"
                  // eslint-disable-next-line recto/q9-controls
                  className={styles.emptyImage}
                  aria-labelledby={`${imageHintId}-action`}
                  aria-describedby={imageHintId}
                  onClick={() => void chooseImage()}
                >
                  <Icon name="image" className={styles.emptyGlyph} />
                  <span id={`${imageHintId}-action`} className={styles.emptyAction}>
                    {m.signature_choose_image()}
                  </span>
                  <span id={imageHintId} className={styles.emptyHint}>
                    {m.signature_image_hint()}
                  </span>
                </button>
              )}
            </SegmentedPanel>
          </div>
        </Segmented>

        <div className={styles.keep}>
          {intent === 'use' ? (
            <Checkbox
              label={keepLabel}
              checked={canKeep && draft.keep}
              disabled={!canKeep}
              description={canKeep ? m.signature_keep_hint() : m.signature_not_kept()}
              onCheckedChange={(keep) => update({ keep })}
            />
          ) : (
            <p className={styles.hint}>
              {canKeep
                ? full
                  ? m.signature_keep_full_hint()
                  : m.signature_keep_hint()
                : m.signature_not_kept()}
            </p>
          )}
          {keeping && canKeep ? (
            <TextField
              label={m.signature_name_label()}
              optional
              value={draft.name}
              maxLength={NAME_MAX}
              autoComplete="off"
              onValueChange={(name) => update({ name })}
            />
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

/** Frames to wait for the new signature's chip to show in the palette. */
const CHIP_WAIT_FRAMES = 12;

/**
 * The Use flight (`flight.ts`): the signature shrinks from where it was in the sheet into its
 * chip, which shows once the saved list has it (a few frames), else into the Sign button.
 */
function intoChip(blob: Blob, from: DOMRect, id: string | undefined): void {
  let frames = 0;
  const find = () => {
    const chip = id ? document.querySelector(`[data-saved-signature="${CSS.escape(id)}"]`) : null;
    if (chip || ++frames >= CHIP_WAIT_FRAMES) {
      const target = chip ?? document.querySelector('[data-tool="signature"]');
      if (target) flyIntoChip(blob, from, target);
      return;
    }
    requestAnimationFrame(find);
  };
  requestAnimationFrame(find);
}

/**
 * The drawing pad: strokes in pad units whatever size it is drawn at, a crisp backing store at
 * the device's pixel ratio, Undo and Clear, and a live count for assistive technology.
 */
function Pad({
  strokes,
  onChange,
}: {
  readonly strokes: readonly Stroke[];
  /** Changes the strokes from the latest ones (two strokes in one frame both count). */
  readonly onChange: (change: (strokes: readonly Stroke[]) => readonly Stroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Point[] | null>(null);
  const [live, setLive] = useState<readonly Point[] | null>(null);
  const [scale] = useState(() =>
    Math.min(3, Math.max(1, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    g.strokeStyle = SIGNATURE_INK;
    g.lineWidth = LINE_WIDTH;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // Traced as the pen smooths its ink (`smooth-ink.ts`), the live stroke too.
    for (const stroke of live ? [...strokes, live] : strokes) {
      if (stroke.length === 0) continue;
      g.beginPath();
      traceSmooth(g, stroke);
      g.stroke();
    }
  }, [strokes, live, scale]);

  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - r.left) / r.width) * PAD_WIDTH,
      y: ((event.clientY - r.top) / r.height) * PAD_HEIGHT,
    };
  };

  const finish = () => {
    const stroke = drawing.current;
    drawing.current = null;
    setLive(null);
    if (stroke && stroke.length > 0) onChange((current) => [...current, stroke]);
  };

  return (
    <div className={styles.padWrap}>
      <div className={styles.padFrame}>
        <canvas
          ref={canvasRef}
          className={styles.pad}
          width={Math.round(PAD_WIDTH * scale)}
          height={Math.round(PAD_HEIGHT * scale)}
          role="img"
          aria-label={m.signature_pad()}
          data-sheet-no-swipe=""
          data-strokes={strokes.length}
          onPointerDown={(e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // A pointer the browser no longer tracks: the stroke still follows the pad.
            }
            drawing.current = [point(e)];
            setLive([...drawing.current]);
          }}
          onPointerMove={(e) => {
            const stroke = drawing.current;
            if (!stroke) return;
            // Coalesced events keep a fast pen's curve (where the browser offers them).
            const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
            if (events.length > 0) {
              const r = e.currentTarget.getBoundingClientRect();
              for (const c of events) {
                stroke.push({
                  x: ((c.clientX - r.left) / r.width) * PAD_WIDTH,
                  y: ((c.clientY - r.top) / r.height) * PAD_HEIGHT,
                });
              }
            } else {
              stroke.push(point(e));
            }
            setLive([...stroke]);
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={() => {
            if (drawing.current) finish();
          }}
        />
        {strokes.length === 0 && !live ? (
          <span className={styles.signHere} aria-hidden="true">
            {m.signature_sign_here()}
          </span>
        ) : null}
        <span className={styles.baseline} aria-hidden="true" />
      </div>
      <div className={styles.padActions} data-bar="signature-pad">
        <Button
          variant="quiet"
          disabled={strokes.length === 0}
          onClick={() => onChange((current) => current.slice(0, -1))}
        >
          {m.signature_undo_stroke()}
        </Button>
        <Button variant="quiet" disabled={strokes.length === 0} onClick={() => onChange(() => [])}>
          {m.signature_clear()}
        </Button>
      </div>
      <p className="visually-hidden" role="status">
        {strokes.length === 0 ? '' : m.signature_drawn({ count: strokes.length })}
      </p>
    </div>
  );
}
