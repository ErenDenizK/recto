/**
 * Tag dot, tag and dot stack (components/09-primitives.md §18): a source document's identity on
 * grid section heads ("● report.pdf · 12"), Library cards and Combine sources. Replace the
 * `[data-tag]` globals.
 *
 * - `TagDot`: 8 px (10 coarse) in `--tag-0…5`, a content colour (`forced-color-adjust: none`,
 *   ringed in `CanvasText` under forced colours). Decorative: the name beside it carries the
 *   meaning (A-19).
 * - `Tag`: the dot and the name, no pill (language.md §1.6); the name truncates with its full
 *   text in `title`.
 * - `DotStack`: a combined document's sources, up to three dots overlapping by 4 px, each ringed
 *   2 px in the host surface's colour, then "+N".
 */
import styles from './Tag.module.css';

/** The six tag colours (`--tag-0…5`). */
export const TAG_COLOURS = 6;

/** The tag colour slot for a document's colour index: stable, whatever the index grows to. */
export function tagSlot(index: number): number {
  const whole = Math.trunc(index);
  return ((whole % TAG_COLOURS) + TAG_COLOURS) % TAG_COLOURS;
}

export function TagDot({
  index,
  className,
}: {
  readonly index: number;
  readonly className?: string | undefined;
}) {
  return (
    <span
      className={[styles.dot, className].filter(Boolean).join(' ')}
      data-tag-slot={tagSlot(index)}
      aria-hidden="true"
    />
  );
}

export function Tag({
  index,
  name,
  className,
}: {
  readonly index: number;
  readonly name: string;
  readonly className?: string | undefined;
}) {
  return (
    <span className={[styles.tag, className].filter(Boolean).join(' ')}>
      <TagDot index={index} />
      <span className={styles.name} title={name}>
        {name}
      </span>
    </span>
  );
}

/** At most this many dots; the rest are "+N". */
export const DOT_STACK_MAX = 3;

export function DotStack({
  indexes,
  className,
}: {
  readonly indexes: readonly number[];
  readonly className?: string | undefined;
}) {
  const shown = indexes.slice(0, DOT_STACK_MAX);
  const more = indexes.length - shown.length;
  return (
    <span className={[styles.stack, className].filter(Boolean).join(' ')} aria-hidden="true">
      {shown.map((index, position) => (
        // Two sources may share a colour slot, so the position is part of the key.
        <TagDot key={`${position}:${index}`} index={index} className={styles.stacked} />
      ))}
      {more > 0 ? <span className={styles.more}>+{more}</span> : null}
    </span>
  );
}
