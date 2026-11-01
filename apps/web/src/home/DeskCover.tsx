/**
 * A cover on the desk (DSN-87, `masa.md` §2.4): the stored image of a page on a sheet with the
 * page's own hairline and `--page-shadow`, fitted to its box by CSS (`--cover-box-h`, the sheet's
 * own aspect ratio), so the image is laid out before it decodes and nothing shifts. The image is
 * content, solid in both themes. With no cover (encrypted source, image failed, not captured
 * yet) the sheet is paper tone with the file glyph centred, never blank and never a shimmer
 * (MOT-4). The tile contract (M3, M4): the sheet carries `data-library-sheet` and the image
 * `data-cover`.
 */
import type { CSSProperties } from 'react';

import { Icon } from '../ui/Icon';
import type { Cover } from './covers';
import styles from './DeskCover.module.css';

/** The page proportion of the paper-tone sheet (A4). */
const PAPER_RATIO = 210 / 297;

export function DeskCover({
  cover,
  className,
}: {
  readonly cover: Cover | undefined;
  readonly className?: string | undefined;
}) {
  const ratio = cover === undefined ? PAPER_RATIO : cover.width / cover.height;
  return (
    <span
      className={[styles.sheet, className].filter(Boolean).join(' ')}
      data-library-sheet=""
      data-empty={cover === undefined || undefined}
      style={{ '--cover-ratio': ratio } as CSSProperties}
    >
      {cover === undefined ? (
        <Icon name="file" className={styles.glyph} />
      ) : (
        <img
          className={styles.image}
          src={cover.url}
          width={cover.width}
          height={cover.height}
          alt=""
          decoding="async"
          draggable={false}
          data-cover=""
        />
      )}
    </span>
  );
}
