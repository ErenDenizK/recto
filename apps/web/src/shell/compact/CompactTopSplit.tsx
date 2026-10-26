/**
 * The split top of the phone reader (DSN-34; the default since DSN-37, `top-variant.ts`), after
 * iOS Preview (`docs/design/reference/ios-preview-2026-10.md` §2): no bar, two pieces over a
 * scroll-edge fade.
 *
 * - **‹** back to the Library, a 44 px glass circle of its own (the capsule's M2 at σ 7,
 *   coverage registry `compact-top-circle`).
 * - **The title** as text centred between the circles, cut in its middle when long (DSN-38,
 *   `title-fit.ts`), in the theme's text colour (GLS-20), with a ▾ in its grey dot
 *   that opens the **title menu**, the reader's one menu (DSN-53): a card with the file's name
 *   (whole, on up to two lines, where the title truncates; its size and pages are Document info's, said once: DSN-52), then Share or
 *   Download a copy (the "Changed" rows once edited), Document info, Contents (when the file has
 *   an outline) and, after a rule, Settings (About is its last row). The ⋯ circle that held
 *   Contents and About is gone: one or two rows were a second menu for little (DSN-53), and
 *   the row keeps its room, so the title stays centred on the window. Preview's Lock,
 *   Duplicate, Move, Rename and Print have no phone job here (the doc's §2.4). The menu lies
 *   over the title and grows out of it (MOT-13, `liquid-menu.ts`).
 * - **The scroll-edge fade** (DSN-35, lighter by DSN-38): a band under the status bar and the
 *   pieces, the theme's canvas colour (GLS-20) fading out downwards over a backdrop blur that a
 *   mask fades out with it. No script per scrolled frame.
 *
 * "n / N" stays in the capsule (DSN-34): no second page indicator under the title. The pieces
 * hide on scroll with the capsule exactly as the capsule top does (`topBarAway`, DSN-32), each
 * moving and fading on itself (Q-3: never a wrapper, which would cut their glass off the page),
 * and the header is `inert` while hidden. Its pieces count as one glass surface (Q-11,
 * `data-glass-group`). Find rides on the keyboard below while this top stays (`CompactTopBar`).
 */
import { Menu } from '@base-ui/react/menu';
import type { VirtualDocument } from '@pdf-editor/document-model';
import { useEffect, useRef } from 'react';

import { m } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import type { SplitTopParts } from './CompactChrome';
import { setMenuOpen, useCompactStore } from './compact-store';
import styles from './CompactTopSplit.module.css';
import { liquidPopupRef, prefetchLiquidMenu } from './liquid-ref';
import { useMiddleTitle } from './title-fit';

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
  // The liquid menus' motion arrives once the browser is idle (DSN-39, `liquid-ref.ts`).
  useEffect(prefetchLiquidMenu, []);
  return (
    <header
      className={styles.top}
      data-hidden={hidden || undefined}
      data-compact-chrome=""
      data-testid="compact-top-bar"
      data-variant="split"
      inert={hidden}
    >
      <div
        className={styles.edge}
        aria-hidden="true"
        data-glass-group={GLASS_GROUP}
        data-gpu-glass="edge"
      />
      <div className={styles.row}>
        <IconButton
          className={styles.circle}
          label={m.compact_library()}
          icon={<Icon name="caret-left" />}
          data-glass-group={GLASS_GROUP}
          data-testid="compact-back"
          data-gpu-glass="circle"
          onClick={parts.showLibrary}
        />
        <FileMenu doc={doc} parts={parts} />
      </div>
    </header>
  );
}

/** The title and its ▾: the file's card, Share or Download a copy, Info, Contents, Settings. */
function FileMenu({
  doc,
  parts,
}: {
  readonly doc: VirtualDocument;
  readonly parts: SplitTopParts;
}) {
  const { SaveItems, toSheet, useFileInfo, prepareCopy, classes } = parts;
  // The store's flag, so the sheets' module is fetched as the menu opens (`CompactSheets`).
  const open = useCompactStore((s) => s.menuOpen);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const title = useMiddleTitle(doc.title, headingRef, textRef);
  const file = useFileInfo(doc);
  const name = file?.name ?? doc.title;
  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        setMenuOpen(next);
        // The copy is ready by the time Share is tapped (`prepareCopy`).
        if (next) prepareCopy(doc).catch(() => undefined);
      }}
    >
      <h1 ref={headingRef} className={styles.heading}>
        <Menu.Trigger
          className={styles.title}
          aria-label={m.compact_title_menu({ title: doc.title })}
          data-testid="compact-title-menu-trigger"
        >
          <span ref={textRef} className={styles.titleText} data-testid="compact-title-text">
            {title}
          </span>
          <span className={styles.chevron} aria-hidden="true">
            <Icon name="caret-down" />
          </span>
        </Menu.Trigger>
      </h1>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="center"
          sideOffset={OVER_TRIGGER}
          collisionPadding={8}
        >
          <Menu.Popup ref={liquidPopupRef} className={classes.menu} data-testid="compact-file-menu">
            <div className={styles.card}>
              <span className={styles.cardGlyph} aria-hidden="true">
                <Icon name="file-text" />
              </span>
              <span className={styles.cardText}>
                <span className={styles.cardName} data-testid="compact-file-name">
                  {name}
                </span>
              </span>
            </div>
            <Menu.Separator className={classes.menuSeparator} />
            <SaveItems doc={doc} />
            <Menu.Item className={classes.menuItem} onClick={toSheet('info')}>
              <Icon name="info" />
              <span>{m.compact_info()}</span>
            </Menu.Item>
            {doc.outline.length > 0 ? (
              <Menu.Item className={classes.menuItem} onClick={toSheet('contents')}>
                <Icon name="tree-view" />
                <span>{m.compact_contents()}</span>
              </Menu.Item>
            ) : null}
            <parts.TextViewRow doc={doc} className={classes.menuItem} />
            <Menu.Separator className={classes.menuSeparator} />
            <Menu.Item className={classes.menuItem} onClick={toSheet('settings')}>
              <Icon name="gear-six" />
              <span>{m.settings_title()}</span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
