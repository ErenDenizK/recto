/**
 * A signature shown as content (components/03-markup.md MK-12 §2, §3): a page-white plate with
 * the signature in its ink, used by the chips, the Signature menu, Settings → Saved signatures
 * and New signature's previews. Drawn signatures are drawn as an SVG path from their strokes,
 * typed ones as SVG text in the UI font (no script font, MK-13 §6), images as the image; each
 * is fitted to the plate with its aspect kept. The plate is decorative wherever its control
 * names the signature; `alt` names it where it stands alone.
 */
import { PAD_HEIGHT, PAD_WIDTH, SIGNATURE_INK, type SignatureInk } from './saved-signatures';
import styles from './SignaturePlate.module.css';

/** The SVG path of strokes in pad units ("M x y L x y …"); a dot for a one-point stroke. */
export function strokesPath(strokes: readonly (readonly number[])[]): string {
  const parts: string[] = [];
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    parts.push(`M${stroke[0]} ${stroke[1]}`);
    if (stroke.length === 2) parts.push(`l0.1 0`);
    for (let i = 2; i + 1 < stroke.length; i += 2) parts.push(`L${stroke[i]} ${stroke[i + 1]}`);
  }
  return parts.join('');
}

/** The strokes' bounds in pad units, padded for the line width, as an SVG viewBox. */
function strokesViewBox(strokes: readonly (readonly number[])[]): string {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const stroke of strokes) {
    for (let i = 0; i + 1 < stroke.length; i += 2) {
      const x = stroke[i] as number;
      const y = stroke[i + 1] as number;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return `0 0 ${PAD_WIDTH} ${PAD_HEIGHT}`;
  const pad = 4;
  return `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
}

export function SignaturePlate({
  ink,
  alt,
  size = 'chip',
  className,
}: {
  readonly ink: SignatureInk;
  /** The signature's name when the plate stands alone; omitted, the plate is decorative. */
  readonly alt?: string | undefined;
  /** `chip` (bars and menus), `row` (Settings) or `preview` (New signature). */
  readonly size?: 'chip' | 'row' | 'preview';
  readonly className?: string | undefined;
}) {
  const label = alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true };
  const classes = [styles.plate, className].filter(Boolean).join(' ');
  return (
    <span className={classes} data-size={size} {...label}>
      {ink.kind === 'image' ? (
        <img className={styles.image} src={ink.dataUrl} alt="" draggable={false} />
      ) : ink.kind === 'drawn' ? (
        <svg
          className={styles.drawing}
          viewBox={strokesViewBox(ink.strokes)}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <path
            d={strokesPath(ink.strokes)}
            fill="none"
            stroke={SIGNATURE_INK}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <span className={styles.typed} style={{ color: SIGNATURE_INK }}>
          {ink.text}
        </span>
      )}
    </span>
  );
}
