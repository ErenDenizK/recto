// @ts-check
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Globals that exist in both Node and browsers (and plain ECMAScript builtins). */
const sharedGlobals = new Set([
  ...Object.keys(globals['shared-node-browser']),
  ...Object.keys(globals.es2025),
]);

/**
 * ADR-0007: the platform-agnostic core must not reach for DOM (or Node) APIs directly;
 * those arrive through injected adapters. Referencing any browser-only or Node-only global
 * in `packages/document-model` is an error.
 */
const platformGlobalsMessage =
  'packages/document-model is platform-agnostic (ADR-0007); inject an adapter instead.';
const restrictedPlatformGlobals = [
  ...Object.keys(globals.browser),
  ...Object.keys(globals.worker),
  ...Object.keys(globals.node),
]
  .filter((name, index, all) => !sharedGlobals.has(name) && all.indexOf(name) === index)
  .map((name) => ({ name, message: platformGlobalsMessage }));

const engineBarrelMessage =
  "A value import of '@pdf-editor/engine' puts the whole engine on the editor's initial path " +
  '(PF-1): write `import type { … }`, take values from a light subpath such as ' +
  "'@pdf-editor/engine/constants', or load the engine with `await import()`.";

/**
 * App modules that value-import the engine barrel and load only behind a lazy boundary (a lazy
 * sheet, `ocr-run`, `rasterize`, the Batch steps), so the barrel stays off the editor's initial
 * path. PF-2 moves them to a light `@pdf-editor/engine/client` subpath and empties this list;
 * nothing is added to it. If one of them becomes static, tools/qa/bundle-budget.ts fails.
 */
const engineBarrelLazyModules = [
  'apps/web/src/batch/steps.ts',
  'apps/web/src/export/SaveCopyPages.tsx',
  'apps/web/src/export/SaveCopySections.tsx',
  'apps/web/src/export/SaveCopySheet.tsx',
  'apps/web/src/export/save-copy-model.ts',
  'apps/web/src/ocr/OcrSheet.tsx',
  'apps/web/src/ocr/ocr-run.ts',
  'apps/web/src/tools/compress-model.ts',
  'apps/web/src/tools/rasterize.ts',
];

/** Q-9 and Q-14's native and hand-styled controls, which ui/ replaces (system audit §3.11). */
const Q9_CONTROLS = [
  {
    selector:
      "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value=/^(checkbox|radio|file)$/]",
    message: 'Q-9: use ui/Checkbox, ui/RadioGroup or a ui/Button that opens a hidden file input.',
  },
  {
    selector: "JSXOpeningElement[name.name='select']",
    message: 'Q-9: use ui/Select (or ui/Segmented for two or three values).',
  },
  {
    selector: "JSXOpeningElement[name.name='button'] > JSXAttribute[name.name='className']",
    message: 'Q-14: use ui/Button or ui/IconButton instead of a hand-styled <button>.',
  },
];

/**
 * Q-9's rule as a local one (its own name, so it never overrides another block's
 * `no-restricted-syntax`): each selector of Q9_CONTROLS reports its message.
 */
const q9Controls = {
  meta: { type: 'suggestion', schema: [] },
  /** @param {import('eslint').Rule.RuleContext} context */
  create(context) {
    return Object.fromEntries(
      Q9_CONTROLS.map(({ selector, message }) => [
        selector,
        /** @param {import('estree').Node} node */
        (node) => context.report({ node, message }),
      ]),
    );
  },
};

/**
 * Files that still render a native or hand-styled control (system-audit-2026-10 §2.5), as the
 * rule arrived: each lane removes its files as it moves them onto ui/.
 */
const Q9_PENDING = [
  'apps/web/src/annotations/ReadSelectionBar.tsx',
  'apps/web/src/annotations/pen/PenWell.tsx',
  'apps/web/src/batch/BatchSheet.tsx',
  'apps/web/src/batch/RecipeEditor.tsx',
  'apps/web/src/batch/StepForm.tsx',
  'apps/web/src/compare/ChangesPanel.tsx',
  'apps/web/src/compare/CompareView.tsx',
  'apps/web/src/crop/CropDialog.tsx',
  'apps/web/src/crop/CropDrawBanner.tsx',
  'apps/web/src/document/DocumentDialogs.tsx',
  'apps/web/src/document/ExportSections.tsx',
  'apps/web/src/export/SaveCopySections.tsx',
  'apps/web/src/forms/FieldEditors.tsx',
  'apps/web/src/forms/FormLayer.tsx',
  'apps/web/src/forms/create/CreatedFieldLayer.tsx',
  'apps/web/src/forms/create/FieldProperties.tsx',
  'apps/web/src/furniture/FurnitureDialogs.tsx',
  'apps/web/src/home/RecentList.tsx',
  'apps/web/src/image-objects/ImageBar.tsx',
  'apps/web/src/image-objects/ImageLayer.tsx',
  'apps/web/src/markup/SignGroup.tsx',
  'apps/web/src/markup/ToolButton.tsx',
  'apps/web/src/ocr/OcrLanguages.tsx',
  'apps/web/src/session/KeptOnDevice.tsx',
  'apps/web/src/settings/rows.tsx',
  'apps/web/src/shell/CommentsPanel.tsx',
  'apps/web/src/shell/FormsPanel.tsx',
  'apps/web/src/shell/OutlinePanel.tsx',
  'apps/web/src/shell/compact/CompactChrome.tsx',
  'apps/web/src/shell/compact/CompactLibrary.tsx',
  'apps/web/src/shell/compact/CompactPassword.tsx',
  'apps/web/src/shell/compact/CompactSheets.tsx',
  'apps/web/src/shell/panels/RedactionsPanel.tsx',
  'apps/web/src/shell/review/WordsToCheck.tsx',
  'apps/web/src/signatures/ExportSignatureSection.tsx',
  'apps/web/src/signatures/NewSignatureSheet.tsx',
  'apps/web/src/signatures/SignDialog.tsx',
  'apps/web/src/stage/ArrangeSection.tsx',
  'apps/web/src/stage/OperationDialogFrame.tsx',
  'apps/web/src/stage/ResizeDialog.tsx',
  'apps/web/src/stage/grid/PagesBar.tsx',
  'apps/web/src/text-edit/ParagraphEditor.tsx',
  'apps/web/src/text-edit/TextEditLayer.tsx',
  'apps/web/src/text-edit/TextEditor.tsx',
  'apps/web/src/viewer/LinkLayer.tsx',
];

/** Files executed by Node: tool configs, scripts, and Playwright specs. */
const nodeFiles = [
  '*.{js,ts}',
  '**/*.config.{js,ts}',
  'tooling/**/*.ts',
  'tools/**/*.{js,ts}',
  // The OCR asset pinning script and Vite plugin (ADR-0012), run by Node like tooling/.
  'packages/engine/ocr/*.ts',
  'apps/web/e2e/**/*.ts',
];

export default defineConfig(
  globalIgnores([
    // Local agent worktrees (Claude Code), full copies of the repository.
    '.claude/',
    '**/dist/',
    '**/build/',
    '**/coverage/',
    '**/node_modules/',
    '**/playwright-report/',
    '**/test-results/',
    '**/blob-report/',
    '.changeset/',
    // Compiled i18n messages (Paraglide), regenerated from apps/web/messages.
    'apps/web/src/i18n/paraglide/',
  ]),

  // Baseline for every file.
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ['error', 'smart'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'object-shorthand': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // Off on purpose: capability detection (ADR-0007) and validation of untrusted input
      // deliberately test values that the DOM lib typings or signatures declare as always
      // present, and this rule would flag every such check.
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // Off on purpose: flags legitimate single-use generics such as branded-id helpers.
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      // Off on purpose: contradicts `no-non-null-assertion` from the strict preset.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
    },
  },

  // Plain JavaScript files (root tool configs) have no TypeScript program.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Tests: `noUncheckedIndexedAccess` makes `items[0]!` the clearest way to state an
  // expectation that a failing test would surface anyway.
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', 'apps/web/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Node-executed files.
  {
    files: nodeFiles,
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },

  // Engine: runs in the browser main thread and in dedicated workers.
  {
    files: ['packages/engine/**/*.ts'],
    ignores: nodeFiles,
    languageOptions: {
      globals: { ...globals.browser, ...globals.worker },
    },
  },

  // Document model: platform-agnostic core (ADR-0007).
  {
    files: ['packages/document-model/**/*.ts'],
    ignores: nodeFiles,
    languageOptions: {
      globals: { ...globals.es2025 },
    },
    rules: {
      'no-restricted-globals': ['error', ...restrictedPlatformGlobals],
    },
  },

  // Web application: React (with the React Compiler) and accessibility.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ignores: nodeFiles,
    extends: [reactHooks.configs.flat['recommended-latest'], jsxA11y.flatConfigs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      // Icons are Phosphor, generated at build time into ui/icons.generated.tsx and drawn by
      // ui/Icon.tsx (ADR-0027 §2.6, 09-primitives §30): neither icon library is imported.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'lucide-react', message: 'Use <Icon name> from ui/Icon (ADR-0027).' },
            {
              name: '@phosphor-icons/react',
              message: 'Use <Icon name> from ui/Icon; add the name to tools/icons/manifest.json.',
            },
          ],
        },
      ],
    },
  },

  // The engine stays off the editor's initial path (docs/plan/v1/PLAN.md PF-1): app code takes
  // only types from the `@pdf-editor/engine` barrel, values from its light subpaths (`/constants`,
  // `/fonts`, …) and the engine itself through `await import()`. Under `verbatimModuleSyntax` an
  // import whose specifiers are all inline `type` still emits `import '@pdf-editor/engine'`,
  // which `allowTypeImports` lets through, hence the syntax rule beside it. Tests and the lazy
  // modules listed above are exempt.
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: [...nodeFiles, '**/*.test.{ts,tsx}', ...engineBarrelLazyModules],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@pdf-editor/engine',
              allowTypeImports: true,
              message: engineBarrelMessage,
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[importKind='value'][source.value='@pdf-editor/engine'], ExportNamedDeclaration[exportKind='value'][source.value='@pdf-editor/engine'], ExportAllDeclaration[source.value='@pdf-editor/engine']",
          message: engineBarrelMessage,
        },
      ],
    },
  },

  // Quality bar Q-9 and Q-14 (system-audit-2026-10 §3.11 gate 4): outside ui/, a control is a
  // ui/ primitive, never a native checkbox, radio, file input or select, nor a hand-styled
  // button. A warning while the lanes move their surfaces onto ui/, an error at the end; files
  // that still break it are listed in Q9_PENDING, which only shrinks (CI allows no warnings).
  {
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['apps/web/src/ui/**', '**/*.test.tsx', ...Q9_PENDING],
    plugins: { recto: { rules: { 'q9-controls': q9Controls } } },
    rules: {
      'recto/q9-controls': 'warn',
    },
  },
);
