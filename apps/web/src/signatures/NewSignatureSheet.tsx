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
 *   comment author's name to start, previewed in the UI font (no script font is bundled).
 *   Image: "Choose image…", a PNG or JPEG (anything the browser reads is re-encoded), previewed.
 * - **Save for next time**, on by default; with five kept it says it replaces the oldest; where
 *   this window keeps nothing it is off and says so. With it on, an optional name.
 * - **Use signature** keeps it (if asked), arms it as the one-shot signature tool and closes:
 *   the next click or drag on a page places it (MK-13 §6). Disabled until there is something to
 *   use, with the reason (RA-21). Opened from Settings (`keep`), the primary is **Save
 *   signature**, it always keeps, and closing returns to Settings → Saved signatures.
 * - **Drafts** (07 §1.1 rule 5): what was drawn, typed or picked stays for the session through
 *   Esc, ✕ or the scrim, and is reset once it is used.
 * - **Accessibility** (MK-13 §8): the pad is `role="img"` with a live "Signature drawn, 3
 *   strokes"; Type is the keyboard path (Tab to the field, type, Enter uses it).
 */
import { type PointerEvent, useEffect, useRef, useState } from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import { pickFiles } from '../files/open-files';
import { m } from '../i18n';
import { openSettings } from '../settings/open-settings';
import { canEditActive } from '../state/ui-store';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Segmented, SegmentedPanel } from '../ui/Segmented';
import { Sheet, type SheetCloseReason, closeSheet, useSheetDraft, useSheetOpen } from '../ui/sheet';
import { TextField } from '../ui/TextField';
import { toast } from '../ui/Toast';
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
    setBusy(true);
    try {
      const saved = keeping && canKeep ? await saveSignature(ink, draft.name) : null;
      const stamp = saved ? await stampOfSignature(saved) : await renderInk(ink);
      resetDraft();
      close('close');
      if (intent === 'use' && stamp && canEditActive()) armSignatureStamp(stamp);
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
        reason: ink === null ? m.signature_empty_reason() : undefined,
        busy,
      }}
      initialFocus={focusRef}
      testId="new-signature-sheet"
    >
      <div
        className={styles.body}
        ref={(el) => {
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
          <SegmentedPanel value="draw" className={styles.panel}>
            <Pad
              strokes={draft.strokes}
              onChange={(change) => setDraft((d) => ({ ...d, strokes: change(d.strokes) }))}
            />
          </SegmentedPanel>
          <SegmentedPanel value="type" className={styles.panel}>
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
              className={styles.preview}
            />
          </SegmentedPanel>
          <SegmentedPanel value="image" className={styles.panel}>
            {draft.image ? (
              <SignaturePlate
                size="preview"
                ink={draft.image}
                alt={m.signature_image_chosen()}
                className={styles.preview}
              />
            ) : (
              <div className={styles.emptyImage}>
                <p>{m.signature_image_hint()}</p>
              </div>
            )}
            <div className={styles.padActions} data-bar="signature-image">
              <Button variant="standard" onClick={() => void chooseImage()}>
                {m.signature_choose_image()}
              </Button>
            </div>
          </SegmentedPanel>
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
    for (const stroke of live ? [...strokes, live] : strokes) {
      const [first, ...rest] = stroke;
      if (!first) continue;
      g.beginPath();
      g.moveTo(first.x, first.y);
      if (rest.length === 0) g.lineTo(first.x + 0.1, first.y);
      for (const p of rest) g.lineTo(p.x, p.y);
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
