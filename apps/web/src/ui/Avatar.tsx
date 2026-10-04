/**
 * Avatar (components/09-primitives.md §18): an author in Review and in notes. A disc of 20, 24
 * or 32 px in the author's tag colour with one initial (11/14, 13/18, 15/20 at 600) in ink, or
 * the `user` glyph when the author is unknown.
 *
 * - The initial is upper-cased in the interface's locale (language.md §4.4 r3: Turkish `i`
 *   gives `İ`), from the first letter of the name, not the first code unit.
 * - Named as an image ("Deniz"; "Unknown author") unless the name is shown beside it, when the
 *   caller passes `decorative` and it is hidden from assistive technology.
 *
 * Base UI `Avatar` (`Root` and `Fallback`; there is no image source in Recto).
 */
import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import { User } from 'lucide-react';

import { getLocale, m } from '../i18n';
import styles from './Avatar.module.css';
import { tagSlot } from './Tag';

/** The first letter of a name, upper-cased in `locale`; null when it has none. */
export function initialOf(name: string | null | undefined, locale: string): string | null {
  const first = name?.trim().match(/\p{L}|\p{N}/u)?.[0];
  return first ? first.toLocaleUpperCase(locale) : null;
}

export interface AvatarProps {
  /** The author's name; empty or missing shows the unknown-author glyph. */
  readonly name: string | null | undefined;
  /** The author's tag colour slot (`--tag-0…5`). */
  readonly index: number;
  readonly size?: 20 | 24 | 32;
  /** Hidden from assistive technology because the name is shown beside it. */
  readonly decorative?: boolean;
  readonly className?: string | undefined;
}

export function Avatar({ name, index, size = 20, decorative = false, className }: AvatarProps) {
  const initial = initialOf(name, getLocale());
  const label = initial ? (name ?? '').trim() : m.avatar_unknown();
  return (
    <BaseAvatar.Root
      className={[styles.avatar, className].filter(Boolean).join(' ')}
      data-size={size}
      data-tag-slot={tagSlot(index)}
      data-unknown={initial ? undefined : ''}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      <BaseAvatar.Fallback className={styles.fallback}>
        {initial ?? <User aria-hidden="true" />}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}
