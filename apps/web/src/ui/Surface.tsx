/**
 * The material host (components/09-primitives.md §26; language.md §2.2–§2.7; spec D3-3): the
 * one place in script that writes material classes. `<Surface tier="chip" sigma={7}
 * coarse={8} lens as="button">` renders the element with `mat mat-chip s7 c8` (the classes a
 * CSS module would compose; `materials.css` holds the rule for each tier × σ the coverage
 * registry lists), `data-tier`, the `SurfaceTier` context and, for a fixed-size M1 chip, the
 * backdrop lens (`styles/material-lens.ts`).
 *
 * A module that composes the same classes (`composes: mat mat-chip s7 c8 from global;`) may
 * pass its class too: the names are merged once. `useSurfaceTier()` tells a control which
 * material it sits on (09 §3: standard and danger buttons render quiet on M1 and M2;
 * `controls.css` does the same in CSS for surfaces drawn by a module alone).
 */
import {
  type ComponentPropsWithRef,
  createContext,
  createElement,
  type ElementType,
  type ReactNode,
  type Ref,
  useContext,
  useImperativeHandle,
  useRef,
} from 'react';

import { useBackdropLens } from '../styles/material-lens';
import type { GlassTier } from '../styles/token-registry';

export type SurfaceTier = GlassTier;

const SurfaceTierContext = createContext<SurfaceTier | null>(null);

/** The material the caller sits on, or null outside any Surface. */
export function useSurfaceTier(): SurfaceTier | null {
  return useContext(SurfaceTierContext);
}

export interface MaterialOptions {
  readonly tier: SurfaceTier;
  /** σ on a fine pointer (`s<σ>`); omitted for a surface that never blurs (lit glass today). */
  readonly sigma?: number | undefined;
  /** σ on a coarse pointer (`c<σ>`), or `'solid'` (`cs`). */
  readonly coarse?: number | 'solid' | undefined;
  /** σ in compact-height (`h<σ>`). */
  readonly short?: number | undefined;
  /** Docked M3 (`mat-docked`). */
  readonly docked?: boolean | undefined;
  /** The tier's solid twin (`mat-opaque`), for a panel across a hard dark/white edge. */
  readonly opaque?: boolean | undefined;
}

/** The material classes for a surface, in the order a module composes them. */
export function materialClasses({
  tier,
  sigma,
  coarse,
  short,
  docked,
  opaque,
}: MaterialOptions): string[] {
  const classes = ['mat', `mat-${tier}`];
  if (docked) classes.push('mat-docked');
  if (opaque) classes.push('mat-opaque');
  if (sigma !== undefined) classes.push(`s${sigma}`);
  if (coarse === 'solid') classes.push('cs');
  else if (coarse !== undefined) classes.push(`c${coarse}`);
  if (short !== undefined) classes.push(`h${short}`);
  return classes;
}

type SurfaceElement = 'div' | 'section' | 'header' | 'nav' | 'aside' | 'button';

export type SurfaceProps<E extends SurfaceElement = 'div'> = MaterialOptions &
  Omit<ComponentPropsWithRef<E>, 'className' | 'children' | 'ref'> & {
    readonly as?: E;
    readonly className?: string | undefined;
    readonly children?: ReactNode;
    readonly ref?: Ref<HTMLElementTagNameMap[E]>;
    /** The backdrop lens: fixed-size M1 chips only (language.md §2.7, X20). */
    readonly lens?: boolean;
  };

export function Surface<E extends SurfaceElement = 'div'>({
  tier,
  sigma,
  coarse,
  short,
  docked,
  opaque,
  lens = false,
  as,
  className,
  children,
  ref,
  ...rest
}: SurfaceProps<E>) {
  const own = useRef<HTMLElement | null>(null);
  useImperativeHandle(ref, () => own.current as HTMLElementTagNameMap[E], []);
  useBackdropLens(own, lens && tier === 'chip');
  const names = materialClasses({ tier, sigma, coarse, short, docked, opaque });
  for (const name of className?.split(/\s+/) ?? []) {
    if (name && !names.includes(name)) names.push(name);
  }
  const element: ElementType = as ?? 'div';
  return (
    <SurfaceTierContext value={tier}>
      {createElement(
        element,
        { ...rest, ref: own, className: names.join(' '), 'data-tier': tier },
        children,
      )}
    </SurfaceTierContext>
  );
}
