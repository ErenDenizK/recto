/**
 * The tool drawer (`design/phone-2026-10/README.md` §3; EDN-8, the owner: "superb, not a
 * makeshift drawer; a floating glass object that rises from below"): the one place where all
 * of phone editing lives.
 *
 * - **Object.** The phone sheet's stays-open form (DSN-53: no scrim, it stays open while the
 *   page is edited): a floating M4 panel (coverage registry `compact-tool-drawer`) in the shape
 *   every phone sheet takes (`sheet-shape.module.css`), inset 16 px from the sides and 12 px
 *   above the island, clear of the home indicator, never taller than 55 % of the screen. Its corners are the island's concentric radius (28 px, `--radius-2xl`, the
 *   island being a 56 px capsule) and its tiles 16 px inside its 12 px padding (S-1). It is a
 *   separate object, never a sheet glued to the bottom edge. Glass Solid gives its solid twin
 *   (`materials.css`); the background light shows through the glass, never cut (DSN-24).
 * - **Motion.** It rises from below the screen's edge, behind the island, on `smooth` and goes
 *   back down, as every phone sheet (`drawer-motion.ts`, MOT-12: transform only, solid while it
 *   moves, its glass clearing at rest); the island stays put; the chip takes the receive pulse
 *   when it has gone, and a tile that arms takes it at once.
 * - **Rows** (at most three): the tools as tiles of glyph and label (fills, no glass in glass;
 *   the armed one in the tool-active fill); the armed tool's options from the registry (Pen and
 *   Highlight: `InkOptions.tsx`); the quiet actions Eraser, Redo and Select.
 * - **Closing** (EDN-18, the owner: "it shouldn't close right away, so I can make another colour
 *   choice or undo"). A tile arms its tool, takes the receive pulse, and the drawer stays open:
 *   the options row turns to the new tool and the chip changes under it. It closes by a press
 *   outside, a swipe down, the chip again, Close in its head (the sheet's head: grabber, "Tools"
 *   and the round caret-down "Close tools", as the list's; never a second "Done" beside the
 *   island's), Esc and Android's back, which put focus back on ▾. A press outside only closes (a transparent
 *   scrim, so it never draws on the page) unless the armed tool's next step is a tap on the
 *   page (Text, Edit text, a chosen signature): then it closes and acts (`drawer-close.ts`).
 *   Undo and Redo stay in reach in the island under it.
 * - **Variant.** With `?drawer=list` the owner's list variant shows instead (`ToolList.tsx`,
 *   EDN-16), to compare on an iPhone; the tiles stay the default.
 * - **Semantics.** A non-modal `dialog` named "Tools"; the tiles are toggle buttons in a group,
 *   so Tab walks tiles, options, quiet actions in reading order. It takes focus when it opens.
 */
import { lazy, Suspense, useState } from 'react';

import { m } from '../../../i18n';
import { receivePulse } from '../../../motion/receive';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { setDrawerOpen, useCompactStore } from '../compact-store';
import shape from '../sheet-shape.module.css';
import { armTool, redo, toggleEraser, toolOff } from './bridge';
import { drawerVariant } from './drawer-variant';
import { DRAWER_ID } from './EditIsland';
import { type CompactToolSpec, toolsIn, useCompactTools } from './registry';
import styles from './ToolDrawer.module.css';
import { useDrawerPanel } from './use-drawer-panel';

/** The owner's list variant (EDN-16), its own chunk, loaded with the island when it is chosen. */
const ToolList = lazy(() => import('./ToolList'));

/** The drawer this tab shows: the tiles (the default) or, with `?drawer=list`, the list. */
export function ToolDrawer() {
  if (drawerVariant() === 'list') {
    return (
      <Suspense fallback={null}>
        <ToolList />
      </Suspense>
    );
  }
  return <TileDrawer />;
}

function TileDrawer() {
  const open = useCompactStore((s) => s.drawerOpen);
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  return shown ? <Panel open={open} onClosed={() => setShown(false)} /> : null;
}

function Panel({ open, onClosed }: { readonly open: boolean; readonly onClosed: () => void }) {
  const tool = useCompactStore((s) => s.tool);
  const specs = useCompactTools();
  const redoable = useWorkspaceStore((s) => s.history.future.length > 0);
  const { panelRef, through, swipe } = useDrawerPanel(open, onClosed);
  const armed = specs.get(tool ?? 'pen');
  const tiles = toolsIn('tile', specs);
  const eraser = specs.get('eraser');

  // The tile answers with the pulse and the drawer stays open (EDN-18).
  const arm = (spec: CompactToolSpec, el: HTMLElement) => {
    if (spec.soon) return;
    void receivePulse(el);
    armTool(spec.id);
  };

  const Options = armed && tool !== null ? armed.Options : undefined;
  const hint = armed && tool !== null && !Options ? armed.hint?.() : undefined;

  return (
    <>
      <div
        className={styles.scrim}
        aria-hidden="true"
        data-testid="compact-drawer-scrim"
        data-through={through || undefined}
        onPointerDown={(event) => {
          event.preventDefault();
          setDrawerOpen(false);
        }}
      />
      <div
        ref={panelRef}
        id={DRAWER_ID}
        role="dialog"
        aria-label={m.compact_tools()}
        tabIndex={-1}
        className={styles.panel}
        data-compact-chrome=""
        data-annotation-keep=""
        data-closing={open ? undefined : ''}
        data-testid="compact-tool-drawer"
        inert={!open}
        {...swipe}
      >
        <div className={shape.head}>
          <span className={shape.grabber} aria-hidden="true" />
          <span className={shape.title}>{m.compact_tools()}</span>
          <IconButton
            label={m.compact_tools_close()}
            tooltipSide="top"
            icon={<Icon name="caret-down" />}
            className={shape.close}
            data-testid="compact-drawer-done"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
        <div className={styles.tiles} role="group" aria-label={m.compact_tools()}>
          {tiles.map((spec) => (
            <Button
              key={spec.id}
              variant="quiet"
              className={styles.tile}
              aria-label={spec.soon ? `${spec.label()}, ${m.compact_tool_soon()}` : spec.label()}
              aria-pressed={tool === spec.id}
              aria-disabled={spec.soon === true || undefined}
              data-tool={spec.id}
              onClick={(event) => arm(spec, event.currentTarget)}
            >
              <Icon name={spec.glyph} filled={tool === spec.id} />
              <span className={styles.tileLabel}>
                {spec.id === 'edit-text' ? m.compact_tool_edit_text_tile() : spec.label()}
              </span>
              {spec.soon ? <span className={styles.soon}>{m.compact_tool_soon()}</span> : null}
            </Button>
          ))}
        </div>
        {Options !== undefined || hint !== undefined ? (
          <div className={styles.options} data-testid="compact-drawer-options">
            {Options ? <Options key={tool} /> : <p className={styles.hint}>{hint}</p>}
          </div>
        ) : null}
        <div className={styles.quiet}>
          {eraser ? (
            <Button
              variant="quiet"
              className={styles.action}
              aria-pressed={tool === 'eraser'}
              onClick={(event) => {
                void receivePulse(event.currentTarget);
                toggleEraser();
              }}
            >
              <Icon name={eraser.glyph} />
              {eraser.label()}
            </Button>
          ) : null}
          <Button
            variant="quiet"
            className={styles.action}
            aria-disabled={!redoable || undefined}
            onClick={() => redo()}
          >
            <Icon name="arrow-u-up-right" />
            {m.compact_redo()}
          </Button>
          <Button
            variant="quiet"
            className={styles.action}
            aria-pressed={tool === null}
            onClick={(event) => {
              void receivePulse(event.currentTarget);
              toolOff();
            }}
          >
            <Icon name="cursor" />
            {m.compact_tool_select()}
          </Button>
        </div>
      </div>
    </>
  );
}
