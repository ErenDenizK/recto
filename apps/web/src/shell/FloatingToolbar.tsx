/**
 * Where the dock and the Markup palette mount in the dock band (`frame/DockBand.tsx`) until
 * the capsule of D2-2 (`shell/capsule/`) takes both into one morphing element.
 *
 * - **Viewing:** a stand-in for the dock's two doors into Markup (flows §4.2): Markup opens the
 *   palette on its Draw set, Fill & sign on its Sign set (`markup/doors.ts`). Pages and More
 *   are the dock's own (D2-2).
 * - **Markup:** the palette (`markup/MarkupPalette.tsx`).
 *
 * The page context menu (stage/PageContextMenu.tsx) mounts with them: both belong to the page
 * view.
 */
import { useLayoutEffect, useRef } from 'react';

import { m } from '../i18n';
import { openMarkupDoor, takeDockFocus } from '../markup/doors';
import { MarkupPalette } from '../markup/MarkupPalette';
import paletteStyles from '../markup/MarkupPalette.module.css';
import { PaletteButton } from '../markup/ToolButton';
import { PageContextMenu } from '../stage/PageContextMenu';
import { useMarkupOpen, useStageView } from '../state/ui-store';
import { Icon } from '../ui/Icon';

export function FloatingToolbar() {
  const pageView = useStageView() === 'page';
  const markup = useMarkupOpen();
  return (
    <>
      {pageView ? markup ? <MarkupPalette /> : <ReadDock /> : null}
      {pageView ? <PageContextMenu /> : null}
    </>
  );
}

/** The dock's doors into Markup (module header). */
function ReadDock() {
  const ref = useRef<HTMLDivElement>(null);
  // Markup closed from inside the palette (Done, Esc): its door takes the focus back.
  useLayoutEffect(() => {
    const door = takeDockFocus();
    if (door === null) return;
    ref.current
      ?.querySelector<HTMLElement>(door === 'sign' ? '[data-dock-fill]' : '[data-dock-markup]')
      ?.focus();
  }, []);
  return (
    <div className={paletteStyles.dock}>
      <div className={paletteStyles.surface} data-region="toolbar" data-bar-view="read">
        <div
          ref={ref}
          role="toolbar"
          aria-label={m.toolbar_label()}
          aria-orientation="horizontal"
          className={paletteStyles.row}
          data-annotation-keep=""
        >
          <div className={paletteStyles.group}>
            <PaletteButton
              label={m.markup_label()}
              icon={<Icon name="pen-nib" />}
              showLabel
              command="mode.edit"
              aria-pressed={false}
              data-dock-markup=""
              data-read-edit=""
              onClick={(event) =>
                openMarkupDoor('draw', { focus: event.currentTarget === document.activeElement })
              }
            />
            <PaletteButton
              label={m.markup_fill_sign()}
              icon={<Icon name="signature" />}
              showLabel
              data-dock-fill=""
              onClick={(event) =>
                openMarkupDoor('sign', { focus: event.currentTarget === document.activeElement })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
