/**
 * The capsule (spec X1; `components/03-markup.md` MK-1; `01-frame.md` F10; quality-bar Q-6):
 * the one M2 glass element at the bottom of the free rectangle that is the dock in viewing and
 * becomes the Markup palette and the Locked state (and, with their packages, the preset strip,
 * the Pages bar and the Compare bar). One DOM node for every content: switching contents never
 * mounts another glass surface, so backdrop, rim, inner light and shadow are always this
 * element's and change shape only through its own width and height (`capsule-morph.ts`).
 *
 * **Material.** M2 (`glass from global`) with one σ per size, not per content: 9 fine, 10 coarse,
 * 8 compact-height (`--glass-capsule-filter`, language.md §2.9). No lens (X20): a line may rest
 * under the dock, and the morph must never change the filter. `contain: layout style`, so the
 * layout a morph costs stays inside the capsule (Q-6); its own box is the one thing that moves.
 *
 * **Slot API** (for D2-3's palette and every later content):
 *
 *   <Capsule shape={shape} morphKey={key}>{(shape) => contentFor(shape)}</Capsule>
 *
 * - `shape` names the content showing (`capsule-content.ts`). Changing it morphs: the old
 *   content stays mounted, `inert` and `aria-hidden`, and fades out in place while the capsule
 *   reshapes around the new one, then unmounts. `children` is therefore called for the shape
 *   showing and for any shape still leaving, with that shape: render from the argument, never
 *   from "the shape now", or a leaving content would turn into the new one mid-fade.
 * - The capsule measures each content itself: a content is laid out at its own size
 *   (`width: max-content`; set the height you need, such as `calc(var(--bar-h) - 2px)` for a
 *   bar inside the 1 px rim), and the capsule rests at that size plus its border, never wider
 *   than the band less 16 px each side. Nothing to pass: fold or wrap inside your content.
 * - `morphKey` asks for a morph inside one content (a group shown, an options chip growing).
 *   Any other size change (a resize, the locale, a fold, labels stacking) is followed at once,
 *   without motion (F10 §7: "label form changes on resize without animation").
 * - Mark the pieces of a content `data-capsule-item="<key>"` (buttons, groups, separators). A
 *   piece whose key was on screen before slides from where it was (the dock's Pages and More
 *   into Locked; D2-3 can give Done the key `markup` so it grows out of the dock's Markup); new
 *   pieces fade in. A content with no marked pieces fades in whole.
 * - Mark the control that should take focus when the content arrives with
 *   `data-capsule-focus` (the dock marks the door Markup closed through). Without one, focus
 *   that was in the capsule goes to the twin of the piece that had it, else the content's Tab
 *   stop (`[tabindex="0"]`). Focus outside the capsule is never moved (MK-1 §6).
 * - The content owns its role and name (`toolbar` "Document tools", `toolbar` "Markup"); the
 *   capsule has none, and is one F6 region (`data-region="toolbar"`) whatever it holds.
 *
 * The snapshot that a morph starts from must be read before React changes the DOM, which only
 * a class component's `getSnapshotBeforeUpdate` can do: `MorphBoundary` is that, and nothing else.
 */
import { Component, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';

import type { CapsuleShape } from './capsule-content';
import { CapsuleMorph, type CapsuleSnapshot, snapshotCapsule } from './capsule-morph';
import styles from './Capsule.module.css';

/** Layers in one fixed DOM order, so React never moves a node that may hold focus. */
const ORDER: readonly CapsuleShape[] = ['dock', 'locked', 'palette', 'pages'];

export interface CapsuleProps {
  /** The content showing now. */
  readonly shape: CapsuleShape;
  /** A change asks for a morph inside the content showing (see the module header). */
  readonly morphKey?: string | number | undefined;
  /** A stroke is in progress on the page: the capsule fades to 20 % (MK-17). */
  readonly stroking?: boolean | undefined;
  /** Renders the content of `shape`; called for the shape showing and any still leaving. */
  readonly children: (shape: CapsuleShape) => ReactNode;
}

interface Layers {
  readonly shape: CapsuleShape;
  readonly leaving: readonly CapsuleShape[];
}

export function Capsule({ shape, morphKey, stroking = false, children }: CapsuleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<Layers>({ shape, leaving: [] });
  // A new shape: the old content stays mounted as leaving until it has faded out.
  let { leaving } = layers;
  if (layers.shape !== shape) {
    leaving = [...layers.leaving.filter((s) => s !== shape), layers.shape];
    setLayers({ shape, leaving });
  }
  const [morph] = useState(
    () =>
      new CapsuleMorph((gone) =>
        setLayers((now) => ({
          shape: now.shape,
          leaving: now.leaving.filter((s) => s !== gone || s === now.shape),
        })),
      ),
  );
  useEffect(() => () => morph.dispose(), [morph]);

  const shown = ORDER.filter((s) => s === shape || leaving.includes(s));
  return (
    <div
      ref={ref}
      className={styles.capsule}
      data-capsule={shape}
      data-region="toolbar"
      data-stroking={stroking ? '' : undefined}
    >
      <MorphBoundary capsule={ref} morph={morph} shape={shape} morphKey={morphKey}>
        {shown.map((s) => {
          const away = s !== shape;
          return (
            <div
              key={s}
              className={styles.layer}
              data-capsule-layer={s}
              data-leaving={away ? '' : undefined}
              aria-hidden={away ? true : undefined}
              inert={away}
            >
              {children(s)}
            </div>
          );
        })}
      </MorphBoundary>
    </div>
  );
}

interface BoundaryProps {
  readonly capsule: RefObject<HTMLDivElement | null>;
  readonly morph: CapsuleMorph;
  readonly shape: CapsuleShape;
  readonly morphKey: string | number | undefined;
  readonly children: ReactNode;
}

/**
 * Reads the capsule as drawn before a commit that changes its shape or morph key, and morphs
 * after it, before paint (React's before-mutation and layout phases).
 */
class MorphBoundary extends Component<BoundaryProps> {
  override getSnapshotBeforeUpdate(previous: BoundaryProps): CapsuleSnapshot | null {
    const element = this.props.capsule.current;
    if (!element) return null;
    if (previous.shape === this.props.shape && previous.morphKey === this.props.morphKey) {
      return null;
    }
    return snapshotCapsule(element);
  }

  override componentDidUpdate(
    previous: BoundaryProps,
    _state: unknown,
    snapshot: CapsuleSnapshot | null,
  ): void {
    const element = this.props.capsule.current;
    if (!element || !snapshot) return;
    this.props.morph.run(element, snapshot, previous.shape !== this.props.shape);
  }

  override render(): ReactNode {
    return this.props.children;
  }
}
