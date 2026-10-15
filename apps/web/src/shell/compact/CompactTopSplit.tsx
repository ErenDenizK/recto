/**
 * The split top of the phone reader (DSN-34, behind `?top=split`, `top-variant.ts`), after iOS
 * Preview (`docs/design/reference/ios-preview-2026-10.md` §2): no bar, three pieces over a
 * scroll-edge fade.
 *
 * - **‹** back to the Library, a 44 px glass circle of its own (the capsule's M2 at σ 7,
 *   coverage registry `compact-top-circle`).
 * - **The title** as text, with a ▾ that opens the **file menu**: a card with the file's name
 *   (whole, on up to two lines, where the title truncates), "PDF · size · pages", then Share or
 *   Download a copy (the "Changed" rows once edited) and Document info. Preview's Lock,
 *   Duplicate, Move, Rename and Print have no phone job here (the doc's §2.4).
 * - **⋯**, the same ⋯ menu as the capsule's (`MoreMenu`), its trigger a glass circle; the menu
 *   lies over the circle and grows out of it (DSN-36).
 * - **The scroll-edge fade** (DSN-35): a band under the status bar and the pieces, the canvas's
 *   tint fading out downwards over a backdrop blur that a mask fades out with it. Pure CSS: no
 *   script runs per scrolled frame.
 *
 * "n / N" stays in the capsule (DSN-34): no second page indicator under the title. The pieces
 * hide on scroll with the capsule exactly as the capsule top does (`topBarAway`, DSN-32), each
 * moving and fading on itself (Q-3: never a wrapper, which would cut their glass off the page),
 * and the header is `inert` while hidden. Its pieces count as one glass surface (Q-11,
 * `data-glass-group`). Find takes the capsule's field in both variants (`CompactTopBar`).
 */
import { Menu } from '@base-ui/react/menu';
import type { VirtualDocument } from '@pdf-editor/document-model';
import { useState } from 'react';

import { formatFileSize } from '../../home/home-model';
import { getLocale, m } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import type { SplitTopParts } from './CompactChrome';
import styles from './CompactTopSplit.module.css';

/** The split top's glass pieces count as one surface (Q-11). */
const GLASS_GROUP = 'compact-top';
/** The menus lie over their trigger (its 44 px), which they grow out of (DSN-36). */
const OVER_TRIGGER = -44;

interface SplitTopProps {
  readonly doc: VirtualDocument;
  /** Away: scrolled, a sheet or the overview (`topBarAway`, as the capsule top). */
  readonly hidden: boolean;
  readonly parts: SplitTopParts;
}

export function CompactTopSplit({ doc, hidden, parts }: SplitTopProps) {
  const { MoreMenu } = parts;
  return (
    <header
      className={styles.top}
      data-hidden={hidden || undefined}
      data-compact-chrome=""
      data-testid="compact-top-bar"
      data-variant="split"
      inert={hidden}
    >
      <div className={styles.edge} aria-hidden="true" data-glass-group={GLASS_GROUP} />
      <div className={styles.row}>
        <IconButton
          className={styles.circle}
          label={m.compact_library()}
          icon={<Icon name="caret-left" />}
          data-glass-group={GLASS_GROUP}
          data-testid="compact-back"
          onClick={parts.showLibrary}
        />
        <FileMenu doc={doc} parts={parts} />
        <MoreMenu
          doc={doc}
          triggerClassName={styles.circle}
          glassGroup={GLASS_GROUP}
          sideOffset={OVER_TRIGGER}
        />
      </div>
    </header>
  );
}

/** The title and its ▾: the file's card, Share or Download a copy, Document info. */
function FileMenu({
  doc,
  parts,
}: {
  readonly doc: VirtualDocument;
  readonly parts: SplitTopParts;
}) {
  const { SaveItems, toSheet, useFileInfo, classes } = parts;
  const [open, setOpen] = useState(false);
  const file = useFileInfo(doc);
  const name = file?.name ?? doc.title;
  const facts = [
    'PDF',
    file ? formatFileSize(file.size, getLocale()) : '',
    m.pages_count({ count: doc.pages.length }),
  ].filter((fact) => fact !== '');
  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <h1 className={styles.heading}>
        <Menu.Trigger
          className={styles.title}
          aria-label={m.compact_title_menu({ title: doc.title })}
          data-testid="compact-title-menu-trigger"
        >
          <span className={styles.titleText}>{doc.title}</span>
          <span className={styles.chevron} aria-hidden="true">
            <Icon name="caret-down" />
          </span>
        </Menu.Trigger>
      </h1>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={OVER_TRIGGER} collisionPadding={8}>
          <Menu.Popup className={classes.menu} data-testid="compact-file-menu">
            <div className={styles.card}>
              <span className={styles.cardGlyph} aria-hidden="true">
                <Icon name="file-text" />
              </span>
              <span className={styles.cardText}>
                <span className={styles.cardName} data-testid="compact-file-name">
                  {name}
                </span>
                <span className={styles.cardFacts}>{facts.join(' · ')}</span>
              </span>
            </div>
            <Menu.Separator className={classes.menuSeparator} />
            <SaveItems doc={doc} />
            <Menu.Item className={classes.menuItem} onClick={toSheet('info')}>
              <Icon name="info" />
              <span>{m.compact_info()}</span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
