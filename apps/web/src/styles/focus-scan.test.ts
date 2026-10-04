/**
 * Source scan for the focus ring (docs/specs/redesign.md D0-1; components/09-primitives.md §19
 * and §27; language.md §9.2): every focus style in the app uses the three forms of
 * `styles/focus.css` (outset, inset, gap) and their tokens, so no rule draws a ring of its own
 * that a band could be missing from.
 *
 * In every style sheet under `src/` except `focus.css`, a rule whose selector puts
 * `:focus-visible` or `:focus` on the element (not `:focus-within`, not inside `:not()`) may set
 * the ring's properties only like this:
 *
 * - `outline-offset`: one of `var(--focus-offset-out | -in | -gap)`;
 * - `outline`: `2px solid var(--focus-light)` (a form restated where `composes` cannot reach,
 *   such as a pseudo-element), or `none` to suppress the ring;
 * - `box-shadow`: a value with `var(--focus-dark)` (a form restated), or `none`;
 * - nothing else: no `outline-color`, `-style` or `-width`, no literal offsets, no accent rings.
 *
 * A suppressed ring clears both bands (`outline: none` with `box-shadow: none`), so no lone dark
 * band is left behind, and is listed in SUPPRESSED with the reason the element shows its focus
 * another way. The retired `--focus-ring` and `--focus-offset` aliases may not appear at all.
 *
 * The rules D0-3's codemod (09-primitives §32 step 4) has not moved yet are in PENDING_D0_3, file
 * by file: the scan skips them, and fails once a listed file is clean, so the list only shrinks.
 */
import { describe, expect, it } from 'vitest';

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Elements whose ring is off on purpose, and how they show focus instead. */
const SUPPRESSED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'annotations/AnnotationLayer.module.css': {
    '.freeText:focus-visible': 'in-place editor (language.md §2.10): its frame and the caret',
  },
  'forms/FormLayer.module.css': {
    '.editor:focus-visible': 'in-place field editor: its border and the caret',
  },
  'forms/create/CreatedFields.module.css': {
    '.layer:focus-visible:not([data-placing])':
      'the layer only routes the keyboard to the fields, which show their own ring',
  },
  'image-objects/ImageObjects.module.css': {
    '.layer:focus-visible': 'focused from script to keep the keys on the page; targets show it',
  },
  'stage/ReadView.module.css': {
    ':global(main:not([data-focus-ring])) .viewport:focus-visible':
      'the pages show their ring only after Tab or F6 (review finding 23)',
  },
  'text-edit/TextEdit.module.css': {
    '.input:focus-visible': 'in-place editor: its frame turns solid, and the caret',
  },
  'ui/Menu.module.css': {
    '.item:focus-visible': 'the highlighted row is the keyboard’s place in a menu',
  },
  'shell/CommandPalette.module.css': {
    '.input:focus-visible': 'the search field’s caret, in a palette that keeps the focus there',
  },
  'outline/Outline.module.css': {
    '.renameInput:focus-visible': 'in-place rename field, there only while editing: its border',
  },
  'stage/InlineTitleEditor.module.css': {
    '.input:focus-visible': 'in-place title field, there only while editing: its border',
  },
};

/**
 * Files whose focus rules still set literal offsets or the retired aliases, for D0-3 to move onto
 * the forms (09-primitives §32 step 4, "44 files for focus"). D0-3 must leave this list empty.
 */
const PENDING_D0_3: readonly string[] = [
  'annotations/StyleControls.module.css',
  'annotations/pen/PenBar.module.css',
  'batch/Batch.module.css',
  'compare/ChangesPanel.module.css',
  'convert/ConvertDialog.module.css',
  'document/DocumentTools.module.css',
  'export/ExportDialog.module.css',
  'furniture/FurnitureDialogs.module.css',
  'home/HomeView.module.css',
  'ocr/Ocr.module.css',
  'privacy/PrivacyIndicator.module.css',
  'shell/CommentsPanel.module.css',
  'shell/EmptyState.module.css',
  'shell/FormsPanel.module.css',
  'shell/LeftRail.module.css',
  'shell/OutlinePanel.module.css',
  'shell/PasswordDialog.module.css',
  'shell/SearchPanel.module.css',
  'shell/Stage.module.css',
  'shell/TabBar.module.css',
  'shell/files/FileRow.module.css',
  'shell/panels/RadioChips.module.css',
  'shell/panels/RedactionsPanel.module.css',
  'signatures/Signatures.module.css',
  'stage/ResizeDialog.module.css',
  'tools/ToolDialog.module.css',
  'ui/Range.module.css',
  'ui/ResizeHandle.module.css',
  'viewer/GoToPageDialog.module.css',
  'viewer/LayoutSwitch.module.css',
];

const ALLOWED_OFFSETS = new Set([
  'var(--focus-offset-out)',
  'var(--focus-offset-in)',
  'var(--focus-offset-gap)',
]);

interface Rule {
  readonly selector: string;
  readonly declarations: ReadonlyMap<string, string>;
}

/** Innermost rules of a style sheet (an `@media` block's rules come out as plain rules). */
function rules(css: string): Rule[] {
  const found: Rule[] = [];
  for (const match of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').trim().replace(/\s+/g, ' ');
    const declarations = new Map<string, string>();
    for (const part of (match[2] ?? '').split(';')) {
      const decl = /^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
      if (decl?.[1] && decl[2]) declarations.set(decl[1], decl[2].replace(/\s+/g, ' '));
    }
    found.push({ selector, declarations });
  }
  return found;
}

/** Whether a selector styles the focused element itself (`:not(:focus-visible)` does not). */
function isFocusRule(selector: string): boolean {
  const own = selector.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '');
  return /:focus(?:-visible)?(?![\w-])/.test(own);
}

/** What is wrong with one style sheet's focus rules. */
function problems(file: string, css: string): string[] {
  const found: string[] = [];
  const source = stripComments(css);
  if (source.includes('var(--focus-ring)')) found.push('uses the retired --focus-ring');
  if (source.includes('var(--focus-offset)')) found.push('uses the retired --focus-offset');
  for (const { selector, declarations } of rules(css)) {
    if (!isFocusRule(selector)) continue;
    const at = `${selector}:`;
    const offset = declarations.get('outline-offset');
    if (offset !== undefined && !ALLOWED_OFFSETS.has(offset)) {
      found.push(`${at} outline-offset ${offset} is not a form's offset`);
    }
    for (const longhand of ['outline-color', 'outline-style', 'outline-width']) {
      if (declarations.has(longhand)) found.push(`${at} sets ${longhand}`);
    }
    const outline = declarations.get('outline');
    const shadow = declarations.get('box-shadow');
    if (outline === 'none') {
      if (shadow !== 'none') found.push(`${at} hides the outline but leaves the dark band`);
      if (SUPPRESSED[file]?.[selector] === undefined) {
        found.push(`${at} hides the ring without an entry in SUPPRESSED`);
      }
    } else if (outline !== undefined && outline !== '2px solid var(--focus-light)') {
      found.push(`${at} outline ${outline} is not the light band`);
    }
    if (shadow !== undefined && shadow !== 'none' && !shadow.includes('var(--focus-dark)')) {
      found.push(`${at} box-shadow ${shadow} replaces the dark band (use --shadow-own)`);
    }
    if (shadow === 'none' && outline !== 'none') {
      found.push(`${at} drops the dark band but keeps the light one`);
    }
  }
  return found;
}

const sheets = import.meta.glob<string>('../**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});
/** Paths relative to `src/` (the glob names this folder's own sheets `./x.css`). */
const files = Object.entries(sheets)
  .map(
    ([path, css]) =>
      [
        path.startsWith('./') ? `styles/${path.slice(2)}` : path.replace(/^\.\.\//, ''),
        css,
      ] as const,
  )
  .filter(([file]) => file !== 'styles/focus.css');

describe('focus scan (09-primitives §19)', () => {
  it('reads the app’s style sheets', () => {
    expect(files.length).toBeGreaterThan(60);
  });

  it('finds no focus style outside the forms', () => {
    const report = files
      .filter(([file]) => !PENDING_D0_3.includes(file))
      .flatMap(([file, css]) => problems(file, css).map((problem) => `${file}: ${problem}`));
    expect(report).toEqual([]);
  });

  it('lists only files that still need D0-3’s codemod', () => {
    for (const file of PENDING_D0_3) {
      const css = sheets[`../${file}`];
      expect(css, `${file} is not a style sheet any more`).toBeDefined();
      expect(problems(file, css ?? ''), `${file} is clean: take it off PENDING_D0_3`).not.toEqual(
        [],
      );
    }
  });

  it('lists only suppressions that exist', () => {
    for (const [file, selectors] of Object.entries(SUPPRESSED)) {
      const css = sheets[`../${file}`];
      expect(css, file).toBeDefined();
      const found = rules(css ?? '');
      for (const selector of Object.keys(selectors)) {
        const rule = found.find((r) => r.selector === selector);
        expect(rule?.declarations.get('outline'), `${file} ${selector}`).toBe('none');
      }
    }
  });

  it('catches what it is for', () => {
    expect(problems('x.css', '.a:focus-visible { outline: var(--focus-ring); }')).toHaveLength(2);
    expect(problems('x.css', '.a:focus-visible { outline-offset: -2px; }')).toEqual([
      ".a:focus-visible: outline-offset -2px is not a form's offset",
    ]);
    expect(problems('x.css', '.a:focus-visible { outline: none; }')).toHaveLength(2);
    expect(problems('x.css', '.a:focus-visible { box-shadow: 0 0 0 1px red; }')).toHaveLength(1);
    expect(problems('x.css', '.a:has(input:focus-visible) { outline-offset: 1px; }')).toHaveLength(
      1,
    );
    expect(problems('x.css', '.a:not(:focus-visible) { box-shadow: 0 0 0 1px red; }')).toEqual([]);
    expect(problems('x.css', '.a:focus-within { outline: 1px solid red; }')).toEqual([]);
    expect(
      problems(
        'x.css',
        '.a::after { outline: 2px solid var(--focus-light); } .b:focus-visible { outline-offset: var(--focus-offset-in); box-shadow: inset 0 0 0 4px var(--focus-dark); }',
      ),
    ).toEqual([]);
  });
});
