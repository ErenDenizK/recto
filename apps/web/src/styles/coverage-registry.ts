/**
 * The coverage registry (docs/specs/redesign.md §6 X24 and D0-1; language.md §2.9, A-2;
 * components/09-primitives.md §27): one entry per glass surface, at the smallest size it renders
 * at. `tokens.test.ts` asserts the coverage rule for each,
 *
 *   c = erf(h / 2√2σ) · erf(w / 2√2σ) ≥ 0.985,
 *
 * with σ the `blur()` of the surface's filter token in `tokens.css`, and that every module rule
 * composing `.glass`, `.glass-menu` or `.glass-frame` is registered here (and nothing else is).
 *
 * Why: a backdrop blur that is large against a surface's size takes its samples from beyond the
 * surface, where nothing is blurred, so the unfiltered page shows through the edges in
 * proportion 1 − c (research 22 §3.2: the 44 px bar at blur 28px rendered #5b5d61 over a white
 * page instead of the model's #47494d, and its secondary text fell from 4.9:1 to 3.6:1). At
 * c ≥ 0.985 the rendered glass stays within about 2/255 of the model the contrast tests use.
 *
 * Where content sets a size, `minWidth` / `minHeight` are a lower bound of what renders (the
 * walker in `e2e/support/glass-walker.ts` checks the same rule on the rendered sizes); fixed
 * sizes are exact. Heights include the 1 px glass border. The families of the redesign extend
 * this list (X24); D0-1 registers today's surfaces on the M8 shell. When `materials.css`
 * replaces the `.glass*` classes (`09-primitives` §26, migration step 6), each entry gains its
 * σ step and the generated rules are checked against it.
 */

/**
 * The token a surface's whole backdrop filter comes from (`tokens.css`): the blur, then its
 * tier's chain. Since D3-2 the tier tokens (`--glass-bar-filter`, `--glass-menu-filter`, …) hold
 * the chain after the blur, as `materials.css` will compose them, so today's `.glass*` classes
 * read σ-carrying tokens: `--glass-filter` (bars, 7px), `--glass-frame-filter` (the docked frame,
 * 5px), `--glass-menu-backdrop` (menus, 12px) and `--glass-menu-short-backdrop` (one row, 7px).
 */
export type GlassFilterToken =
  | '--glass-filter'
  | '--glass-menu-backdrop'
  | '--glass-menu-short-backdrop'
  | '--glass-frame-filter';

/** What a module rule composes from `global.css`. */
export type GlassComposition = 'glass' | 'glass glass-menu' | 'glass-frame';

export interface GlassSurfaceEntry {
  /** Stable id, kebab case. */
  readonly id: string;
  /** What a person calls it. */
  readonly surface: string;
  /** The CSS module, relative to `src/`. */
  readonly module: string;
  /** The module class whose rule composes the glass (`.toolbar`). */
  readonly selector: string;
  readonly composes: GlassComposition;
  readonly filter: GlassFilterToken;
  /** Smallest rendered width and height, CSS px. */
  readonly minWidth: number;
  readonly minHeight: number;
  /** Where that smallest size comes from. */
  readonly smallest: string;
}

export const COVERAGE_REGISTRY: readonly GlassSurfaceEntry[] = [
  {
    id: 'floating-bar',
    surface: 'Floating tool bar',
    module: 'shell/FloatingToolbar.module.css',
    selector: '.toolbar',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 76,
    minHeight: 44,
    smallest: "44 px fixed; Read's one Edit button is the narrowest (76 px)",
  },
  {
    id: 'options-tier',
    surface: 'Options tier',
    module: 'shell/FloatingToolbar.module.css',
    selector: '.tier',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 120,
    minHeight: 40,
    smallest: 'min-height 40 px; one style row',
  },
  {
    id: 'read-selection-bar',
    surface: 'Text selection bar',
    module: 'annotations/ReadSelectionBar.module.css',
    selector: '.bar',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 120,
    minHeight: 44,
    smallest: '--bar-h, 44 px on a fine pointer (D0-3, Q-9); Copy and the markups',
  },
  {
    id: 'annotation-bar',
    surface: 'Annotation contextual bar',
    module: 'annotations/AnnotationLayer.module.css',
    selector: '.bar',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 160,
    minHeight: 44,
    smallest: '--bar-h, 44 px on a fine pointer (D0-3, Q-9)',
  },
  {
    id: 'note-popup',
    surface: 'Note popup',
    module: 'annotations/AnnotationLayer.module.css',
    selector: '.notePopup',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 240,
    minHeight: 120,
    smallest: '240 px wide; author line, an empty text area and the actions',
  },
  {
    id: 'image-bar',
    surface: 'Image contextual bar',
    module: 'image-objects/ImageObjects.module.css',
    selector: '.bar',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 160,
    minHeight: 44,
    smallest: '--bar-h, 44 px on a fine pointer (D0-3, Q-9)',
  },
  {
    id: 'form-notice',
    surface: 'Form field notice',
    module: 'forms/FormLayer.module.css',
    selector: '.notice',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 180,
    minHeight: 54,
    smallest: 'min-width 180 px; a title and one line',
  },
  {
    id: 'form-lock-notice',
    surface: "Read's form lock notice",
    module: 'forms/FormLayer.module.css',
    selector: '.lockNotice',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 160,
    minHeight: 36,
    smallest: '5 px around its 24 px Edit button, the border: 36 px (was 34 px, c 0.9848 at 7px)',
  },
  {
    id: 'arrange-bar',
    surface: 'Arrange contextual bar',
    module: 'stage/ArrangeView.module.css',
    selector: '.contextBar',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 160,
    minHeight: 44,
    smallest: '32 px buttons, 5 px padding, the border: 44 px (D0-3, Q-9)',
  },
  {
    id: 'crop-banner',
    surface: 'Crop banner',
    module: 'crop/Crop.module.css',
    selector: '.banner',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 200,
    minHeight: 46,
    smallest: '28 px buttons, 8 px padding, the border: 46 px',
  },
  {
    id: 'compare-toolbar',
    surface: 'Compare tool bar',
    module: 'compare/CompareView.module.css',
    selector: '.toolbar',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 160,
    minHeight: 44,
    smallest: '32 px buttons, 5 px padding, the border: 44 px (D0-3, Q-9)',
  },
  {
    id: 'compare-progress',
    surface: 'Compare progress card',
    module: 'compare/CompareView.module.css',
    selector: '.progress',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 288,
    minHeight: 60,
    smallest: 'min(420 px, the stage less 32 px); a label, the bar and Cancel',
  },
  {
    id: 'command-palette',
    surface: 'Command palette',
    module: 'shell/CommandPalette.module.css',
    selector: '.popup',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 288,
    minHeight: 140,
    smallest: 'min(600 px, the window less 32 px); the search row, an empty list, the footer',
  },
  {
    id: 'paragraph-editor-header',
    surface: 'Paragraph editor header',
    module: 'text-edit/ParagraphEditor.module.css',
    selector: '.header',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 220,
    minHeight: 38,
    smallest: 'min-width 220 px; one row at the least',
  },
  {
    id: 'text-edit-panel',
    surface: 'Text edit header',
    module: 'text-edit/TextEdit.module.css',
    selector: '.panel',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 200,
    minHeight: 38,
    smallest: 'min-width 200 px; one row at the least',
  },
  {
    id: 'menu',
    surface: 'Menus and context menus',
    module: 'ui/Menu.module.css',
    selector: '.popup',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 200,
    minHeight: 78,
    smallest: 'min-width 200 px; two 32 px rows, 6 px padding, the border: 78 px',
  },
  {
    id: 'menu-one-row',
    surface: 'One-row menu',
    module: 'ui/Menu.module.css',
    selector: '.popup',
    composes: 'glass glass-menu',
    filter: '--glass-menu-short-backdrop',
    minWidth: 200,
    minHeight: 46,
    smallest: "Recents' Remove: one 32 px row, 6 px padding, the border: 46 px",
  },
  {
    id: 'popover',
    surface: 'Popovers',
    module: 'ui/Popover.module.css',
    selector: '.popup',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 288,
    minHeight: 72,
    smallest: 'min(320 px, the window less 16 px); a title and one line',
  },
  {
    id: 'sheet-side',
    surface: 'Side sheet (tool, task, Settings)',
    module: 'ui/sheet/Sheet.module.css',
    selector: '.panel',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 304,
    minHeight: 200,
    smallest:
      'min(360 px, the window less 16 px) on a compact-height window; its height there less the title bar and 16 px',
  },
  {
    id: 'sheet-form',
    surface: 'Form sheet',
    module: 'ui/sheet/Sheet.module.css',
    selector: '.panel',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 568,
    minHeight: 160,
    smallest:
      "min(640 px, the window less 32 px) at the medium class's 600 px; a header, one row and the footer",
  },
  {
    id: 'sheet-dialog',
    surface: 'Centred dialog and confirmation',
    module: 'ui/sheet/Sheet.module.css',
    selector: '.panel',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 288,
    minHeight: 168,
    smallest:
      "min(400 px, the window less 32 px) at 320 px; 07-sheets §2.2's shortest confirmation",
  },
  {
    id: 'sheet-overlay',
    surface: 'Shortcuts overlay',
    module: 'ui/sheet/Sheet.module.css',
    selector: '.panel',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 536,
    minHeight: 240,
    smallest: "min(760 px, the window less 64 px) at the medium class's 600 px",
  },
  {
    id: 'sheet-bottom',
    surface: 'Bottom sheet',
    module: 'ui/sheet/Sheet.module.css',
    selector: '.panel',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 320,
    minHeight: 140,
    smallest:
      "the window's 320 px; the shortest compact confirmation (the bleed below the window not counted)",
  },
  {
    id: 'sheet-full',
    surface: 'Full sheet',
    module: 'ui/sheet/Sheet.module.css',
    selector: '.panel',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 320,
    minHeight: 248,
    smallest: 'a 320 × 256 window (A-20) under the 8 px top inset',
  },
  {
    id: 'compact-top-bar',
    surface: 'Compact edition top bar',
    module: 'shell/compact/CompactChrome.module.css',
    selector: '.topBar',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 320,
    minHeight: 45,
    smallest: 'a 44 px row and its bottom border on a 320 px phone (more with a safe area)',
  },
  {
    id: 'compact-capsule',
    surface: 'Compact edition bottom capsule',
    module: 'shell/compact/CompactChrome.module.css',
    selector: '.capsule',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 120,
    minHeight: 56,
    smallest: '56 px fixed; two 44 px controls at the least',
  },
  {
    id: 'compact-menu',
    surface: 'Compact edition ⋯ menu',
    module: 'shell/compact/CompactChrome.module.css',
    selector: '.menu',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 232,
    minHeight: 102,
    smallest: 'min-width 232 px; two 44 px rows, 6 px padding, the border: 102 px',
  },
  {
    id: 'compact-menu-one-row',
    surface: 'Compact edition one-row menu',
    module: 'shell/compact/CompactChrome.module.css',
    selector: '.menu',
    composes: 'glass glass-menu',
    filter: '--glass-menu-short-backdrop',
    minWidth: 232,
    minHeight: 58,
    smallest: 'one 44 px row, 6 px padding, the border: 58 px',
  },
  {
    id: 'compact-sheet',
    surface: 'Compact edition bottom sheet',
    module: 'shell/compact/CompactSheet.module.css',
    selector: '.sheet',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 320,
    minHeight: 140,
    smallest: 'the shortest sheet (Go to page): its handle, title and one field',
  },
  {
    id: 'compact-note-popover',
    surface: 'Compact edition note popover',
    module: 'shell/compact/NoteLayer.module.css',
    selector: '.popup',
    composes: 'glass glass-menu',
    filter: '--glass-menu-backdrop',
    minWidth: 296,
    minHeight: 96,
    smallest: 'min(320 px, the window less 24 px); its header with Close and one line',
  },
  {
    id: 'title-bar',
    surface: 'Title bar (tab bar)',
    module: 'shell/TabBar.module.css',
    selector: '.bar',
    composes: 'glass-frame',
    filter: '--glass-frame-filter',
    minWidth: 320,
    minHeight: 44,
    smallest: '44 px fine, 56 px coarse (--titlebar-height, quality-bar Q-9)',
  },
  {
    id: 'status-bar',
    surface: 'Status bar',
    module: 'shell/StatusBar.module.css',
    selector: '.bar',
    composes: 'glass-frame',
    filter: '--glass-frame-filter',
    minWidth: 320,
    minHeight: 28,
    smallest: '28 px fixed (--statusbar-height), the shortest frame bar',
  },
  {
    id: 'navigator',
    surface: 'Navigator (left rail and panel)',
    module: 'shell/LeftRail.module.css',
    selector: '.left',
    composes: 'glass-frame',
    filter: '--glass-frame-filter',
    minWidth: 64,
    minHeight: 200,
    smallest: 'the 64 px rail with its panel closed',
  },
  {
    id: 'inspector',
    surface: 'Inspector (right panel)',
    module: 'shell/RightPanel.module.css',
    selector: '.panel',
    composes: 'glass-frame',
    filter: '--glass-frame-filter',
    minWidth: 240,
    minHeight: 200,
    smallest: 'its narrowest width',
  },
  {
    id: 'toast',
    surface: 'Toast and progress capsule (08-feedback FB4, FB5)',
    module: 'ui/Toast/Toast.module.css',
    selector: '.toast',
    composes: 'glass',
    filter: '--glass-filter',
    minWidth: 240,
    minHeight: 40,
    smallest:
      'the progress capsule: 40 px fine, at least 240 px wide; a toast is 48 px and 360 px (one surface each, at most three)',
  },
];
