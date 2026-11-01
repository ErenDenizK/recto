/**
 * The door to the Text view's lazy chunk (PRD-36, EDN-26; `textview/`): the view, its bar and
 * its data load by `import()` on intent only. The row in the title menu prefetches on
 * `pointerdown` or `focus` and loads at the latest on the tap; nothing loads on idle or when
 * the menu opens, so the read session's cost does not change, and with the Labs flag off no row
 * exists and none of this runs. A failed fetch is retried on the next intent.
 *
 * Only what the static phone session cannot do without is here (the compact bundle grows by
 * under 1 KB with the flag off, EDN-26): the row, the slot, the reader's port and the loader.
 * Opening, closing, the session, the place maths and the follow of the stores are
 * `textview-shown.tsx`.
 */
import { Menu } from '@base-ui/react/menu';
import type { VirtualDocument } from '@pdf-editor/document-model';

import { m } from '../../i18n';
import { textViewOn } from '../../textview/text-view-flag';
import { Icon } from '../../ui/Icon';
import { closeMenusAtOnce } from '../../ui/menu-handoff';
import { useCompactStore } from './compact-store';
import type { ReaderFrame, ReaderLayout } from './reader-layout';
import type * as ShownModule from './textview-shown';

let loading: Promise<typeof ShownModule> | undefined;
let loaded: typeof ShownModule | undefined;

/** Fetches the chunk once; a failed fetch (offline before the precache filled) is retried. */
function loadTextView(): Promise<typeof ShownModule> {
  loading ??= import('./textview-shown').then(
    (module) => {
      loaded = module;
      return module;
    },
    (error: unknown) => {
      loading = undefined;
      throw error;
    },
  );
  return loading;
}

const prefetch = () => void loadTextView().catch(() => undefined);

/** What the reader lends the door (`CompactReader.tsx`): its scroller, layout and frame. */
export interface TextViewReader {
  readonly scroller: HTMLElement;
  /** The latest layout and frame. */
  latest(): { readonly layout: ReaderLayout; readonly frame: ReaderFrame };
  /** Scrolls to a position of the reader's own choosing. */
  scrollTo(left: number, top: number): void;
}

let reader: TextViewReader | null = null;

/** Lends the reader to the door; returns the withdrawal. */
export function registerTextViewReader(port: TextViewReader): () => void {
  reader = port;
  return () => {
    if (reader === port) reader = null;
  };
}

/**
 * The title menu's row (behind Labs `text-view`): "Text view", or "Page view" while it shows.
 * The menu goes at once, then the view opens or closes.
 */
export function TextViewRow({
  doc,
  className,
}: {
  readonly doc: VirtualDocument;
  readonly className: string | undefined;
}) {
  const open = useCompactStore((s) => s.textView);
  if (!textViewOn()) return null;
  return (
    <Menu.Item
      className={className}
      data-testid="compact-text-view-row"
      onPointerDown={prefetch}
      onFocus={prefetch}
      onClick={() => {
        closeMenusAtOnce();
        loadTextView()
          .then((module) => module.toggleTextView(doc, reader))
          .catch(() => undefined);
      }}
    >
      <Icon name="text-aa" />
      <span>{open ? m.text_view_close() : m.text_view_open()}</span>
    </Menu.Item>
  );
}

/** The slot in the reader: nothing until the Text view opens, then the view over the reader. */
export function TextViewSlot({ doc }: { readonly doc: VirtualDocument }) {
  const open = useCompactStore((s) => s.textView);
  // The flag is set only by the loaded chunk, so it is here whenever the view shows.
  return open && loaded ? <loaded.TextViewShown doc={doc} reader={reader} /> : null;
}
