/**
 * The tool drawer (`design/phone-2026-10/README.md` §3; EDN-8, the owner: "superb, not a
 * makeshift drawer; a floating glass object that rises from below"): the one place where all
 * of phone editing lives.
 *
 * - **Object.** A floating M4 panel (coverage registry `compact-tool-drawer`), inset 16 px from
 *   the sides and 12 px above the island, clear of the home indicator, never taller than 55 %
 *   of the screen. Its corners are the island's concentric radius (28 px, `--radius-2xl`, the
 *   island being a 56 px capsule) and its tiles 16 px inside its 12 px padding (S-1). It is a
 *   separate object, never a sheet glued to the bottom edge. Glass Solid gives its solid twin
 *   (`materials.css`); the background light shows through the glass, never cut (DSN-24).
 * - **Motion.** It rises out of the tool chip by the container transform on `smooth` and goes
 *   back into it (`drawer-motion.ts`, MOT-5); the island stays put; the chip takes the receive
 *   pulse when it has gone back in, and a tile that arms takes it at once.
 * - **Rows** (at most three): the tools as tiles of glyph and label (fills, no glass in glass;
 *   the armed one in the tool-active fill); the armed tool's options from the registry (Pen and
 *   Highlight: `InkOptions.tsx`); the quiet actions Eraser, Redo and Select.
 * - **Closing.** A tile arms its tool and closes the drawer (Sign's keeps it open on its
 *   signatures, `keepsDrawer`, EDN-14) once the tile's pulse has crested
 *   (`drawer-close.ts`, no timer); so do a swipe down, a press outside
 *   (on a transparent scrim, so it never draws on the page) and the chip again. Esc closes it
 *   and puts focus back on ▾.
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
import { setDrawerOpen, useCompactStore } from '../compact-store';
import { armTool, redo, toggleEraser, toolOff } from './bridge';
import { closeDrawerAfter } from './drawer-close';
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
  const { panelRef, swipe } = useDrawerPanel(open, onClosed);
  const armed = specs.get(tool ?? 'pen');
  const tiles = toolsIn('tile', specs);
  const eraser = specs.get('eraser');

  const arm = (spec: CompactToolSpec, el: HTMLElement) => {
    if (spec.soon) return;
    const crest = receivePulse(el);
    armTool(spec.id);
    // The tile's swell crests, then the drawer goes back into the chip (drawer-close.ts).
    if (!spec.keepsDrawer) closeDrawerAfter(crest);
  };

  const Options = armed && tool !== null ? armed.Options : undefined;
  const hint = armed && tool !== null && !Options ? armed.hint?.() : undefined;

  return (
    <>
      <div
        className={styles.scrim}
        aria-hidden="true"
        data-testid="compact-drawer-scrim"
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
        <span className={styles.grabber} aria-hidden="true" />
        <div className={styles.tiles} role="group" aria-label={m.compact_tools()}>
          {tiles.map((spec) => (
            <Button
              key={spec.id}
              variant="quiet"
              className={styles.tile}
              aria-pressed={tool === spec.id}
              aria-disabled={spec.soon === true || undefined}
              data-tool={spec.id}
              onClick={(event) => arm(spec, event.currentTarget)}
            >
              <Icon name={spec.glyph} filled={tool === spec.id} />
              <span className={styles.tileLabel}>{spec.label()}</span>
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
