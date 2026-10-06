/**
 * S21 Batch and recipes (`components/07-sheets.md` §22; spec D2-9; batch spec §5): run a recipe
 * over many files without opening them as tabs, on the one Sheet primitive: a centred 720
 * dialog from expanded up with the recipes and the files side by side, a 640 form on medium, a
 * bottom sheet below (`presentation.ts`, kind `batch`). Reached from ⌘K and the Library's ⋯;
 * guard none (the files are not open documents). The recipe editor is a pushed page: the
 * sheet's ‹ Back returns to the recipes.
 *
 * Setup: pick a recipe (built-in or saved; import, export, duplicate, rename, delete, or
 * build one in the editor), drop or pick files, review the plan (files kept and skipped
 * with reasons, steps this build cannot run, the password asked once for the batch, with
 * confirmation and never stored), then Run. The run lists every file with its status,
 * notices (the export summary's honesty lines) and failures; Cancel stops it. The result
 * offers the outputs as one ZIP (the default for several), one by one, or into a folder
 * (Chromium). Encrypted inputs ask for their password inside the dialog, once per file.
 */
import {
  BUILT_IN_RECIPES,
  checkRecipeInputs,
  describeRecipe,
  RECIPE_FILE_EXTENSION,
  RECIPE_FORMAT,
  RECIPE_VERSION,
  type Recipe,
  type RecipeError,
  type RecipeRunPlan,
  planRecipeRun,
  utf8ByteLength,
} from '@pdf-editor/document-model';
import {
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { formatBytes, isHiddenName } from '../files/file-filters';
import { dragHasFiles, filesFromDataTransfer, pickFiles } from '../files/open-files';
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { deliverFile } from '../tools/deliver-file';
import tool from '../tools/ToolDialog.module.css';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/sheet';
import styles from './Batch.module.css';
import { closeBatchDialog, useBatchStore } from './batch-store';
import {
  deliverEach,
  deliverToFolder,
  deliverZip,
  safeFileStem,
  supportsFolderDelivery,
  zipName,
} from './deliver';
import {
  builtInDescription,
  builtInName,
  failureReasonLabel,
  outputFormatLabel,
  recipeErrorText,
  skipReasonLabel,
  stepDetail,
  stepKindLabel,
  waitingForLabel,
} from './labels';
import { RecipeEditor } from './RecipeEditor';
import { getRecipeStore, type RecipeBackendKind, type RecipeListEntry } from './recipes-store';
import { type BatchFileState, type BatchRunResult, runRecipe } from './runner';

export const BATCH_SHEET = 'batch';

export default function BatchSheet() {
  const open = useBatchStore((s) => s.open);
  // Each opening starts afresh (a new flow); the last one stays while the sheet plays its exit.
  const [opening, setOpening] = useState({ open, serial: 0 });
  if (open !== opening.open) setOpening({ open, serial: opening.serial + (open ? 1 : 0) });
  return <BatchFlow key={opening.serial} open={open} />;
}

type View =
  | { readonly kind: 'setup' }
  | { readonly kind: 'edit'; readonly id: string | undefined; readonly recipe: Recipe }
  | { readonly kind: 'run' };

interface PasswordAsk {
  readonly fileName: string;
  readonly incorrect: boolean;
  readonly resolve: (password: string | null) => void;
}

interface RunState {
  readonly plan: RecipeRunPlan;
  readonly files: readonly BatchFileState[];
  readonly controller: AbortController;
  readonly result?: BatchRunResult;
  readonly error?: string;
  readonly ask?: PasswordAsk;
  readonly delivered?: string;
  /** Before the first file of an OCR recipe: the recognizer starting, languages loading. */
  readonly preparing?: string;
}

interface Status {
  readonly text: string;
  readonly tone: 'info' | 'error';
  readonly detail?: string;
  readonly undo?: () => void;
}

function entryName(entry: RecipeListEntry): string {
  return entry.builtInId === undefined
    ? entry.recipe.name
    : builtInName(entry.builtInId, entry.recipe.name);
}

function entryDescription(entry: RecipeListEntry): string | undefined {
  const own = entry.recipe.description;
  if (entry.builtInId === undefined) return own;
  return builtInDescription(entry.builtInId, own ?? '');
}

function fileKey(file: File): string {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

const NEW_RECIPE: Recipe = {
  format: RECIPE_FORMAT,
  version: RECIPE_VERSION,
  name: '',
  steps: [],
};

const DEFAULT_ID = `builtin:${BUILT_IN_RECIPES.find((b) => b.id === 'number-pages')?.id ?? ''}`;

function BatchFlow({ open }: { readonly open: boolean }) {
  const store = getRecipeStore();
  const [entries, setEntries] = useState<readonly RecipeListEntry[]>([]);
  const [backend, setBackend] = useState<RecipeBackendKind | null>(null);
  const [selectedId, setSelectedIdState] = useState(DEFAULT_ID);
  const [view, setView] = useState<View>({ kind: 'setup' });
  const [files, setFiles] = useState<readonly File[]>([]);
  const [passwords, setPasswords] = useState<Readonly<Record<string, string>>>({});
  const [confirms, setConfirms] = useState<Readonly<Record<string, string>>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [over, setOver] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const runRef = useRef<RunState | null>(null);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // The passwords typed are for the recipe they were typed for: another one starts empty.
  const setSelectedId = (id: string) => {
    setSelectedIdState(id);
    setPasswords({});
    setConfirms({});
  };

  const refresh = async () => {
    setEntries(await store.list());
  };
  useEffect(() => {
    let live = true;
    void store.list().then((list) => {
      if (live) setEntries(list);
    });
    void store.backend().then((kind) => {
      if (live) setBackend(kind);
    });
    return () => {
      live = false;
      runRef.current?.controller.abort();
      runRef.current?.ask?.resolve(null);
    };
  }, [store]);
  // Closing the sheet stops a run and forgets its outputs and passwords (the next opening is a
  // new flow).
  useEffect(() => {
    if (open) return;
    runRef.current?.controller.abort();
    runRef.current?.ask?.resolve(null);
  }, [open]);

  const selected = entries.find((e) => e.id === selectedId) ?? entries[0];
  const recipe = selected?.recipe;
  const summary = useMemo(() => (recipe ? describeRecipe(recipe) : undefined), [recipe]);
  const plan = useMemo(
    () =>
      recipe && files.length > 0
        ? planRecipeRun(
            recipe,
            files.map((f) => ({ name: f.name, size: f.size })),
          )
        : undefined,
    [recipe, files],
  );

  const values = useMemo(() => new Map(Object.entries(passwords)), [passwords]);
  const inputProblems = plan ? checkRecipeInputs(plan, values) : [];
  const mismatched = (plan?.inputs ?? []).filter(
    (input) => (passwords[input.id] ?? '') !== (confirms[input.id] ?? ''),
  );
  const canRun =
    plan !== undefined && plan.runnable && inputProblems.length === 0 && mismatched.length === 0;

  const addFiles = (added: readonly File[]) => {
    if (added.length === 0) return;
    setFiles((current) => {
      const seen = new Set(current.map(fileKey));
      return [...current, ...added.filter((f) => !seen.has(fileKey(f)))];
    });
  };

  const onDragOver = (event: globalThis.DragEvent) => {
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    const accepting = view.kind === 'setup';
    if (event.dataTransfer) event.dataTransfer.dropEffect = accepting ? 'copy' : 'none';
    setOver(accepting);
  };
  const onDrop = (event: globalThis.DragEvent) => {
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setOver(false);
    if (view.kind !== 'setup') return;
    // Everything but hidden files: the plan lists what it skips and why.
    const data = event.dataTransfer;
    if (data) void filesFromDataTransfer(data, (f) => !isHiddenName(f.name)).then(addFiles);
  };

  // Drags anywhere on the sheet are the batch's (its header too): they never reach the window,
  // which would open the file in the tab, nor the shell, which would open them as documents.
  // Native listeners on the sheet's panel, found from the flow once the portal has mounted it,
  // read the latest handlers.
  const drag = useRef({ over: onDragOver, drop: onDrop });
  useLayoutEffect(() => {
    drag.current = { over: onDragOver, drop: onDrop };
  });
  const flowRef = (flow: HTMLDivElement | null) => {
    const panel = flow?.closest<HTMLElement>('[data-sheet]');
    if (!panel) return undefined;
    const enter = (event: globalThis.DragEvent) => {
      if (dragHasFiles(event.dataTransfer)) event.stopPropagation();
    };
    const over = (event: globalThis.DragEvent) => drag.current.over(event);
    const leave = (event: globalThis.DragEvent) => {
      event.stopPropagation();
      setOver(false);
    };
    const drop = (event: globalThis.DragEvent) => drag.current.drop(event);
    panel.addEventListener('dragenter', enter);
    panel.addEventListener('dragover', over);
    panel.addEventListener('dragleave', leave);
    panel.addEventListener('drop', drop);
    return () => {
      panel.removeEventListener('dragenter', enter);
      panel.removeEventListener('dragover', over);
      panel.removeEventListener('dragleave', leave);
      panel.removeEventListener('drop', drop);
    };
  };

  const importRecipe = async (file: File | undefined) => {
    if (file === undefined) return;
    const result = await store.importText(await file.text());
    if (result.ok) {
      await refresh();
      setSelectedId(result.id);
      setStatus({ tone: 'info', text: m.batch_imported({ name: result.recipe.name }) });
    } else {
      setStatus(importError(result.error));
    }
  };

  const exportRecipe = async (entry: RecipeListEntry) => {
    const { name, text } = await store.exportText(entry.id);
    const stem = safeFileStem(entryName(entry), name);
    const outcome = await deliverFile(
      new Blob([text], { type: 'application/json' }),
      `${stem}${RECIPE_FILE_EXTENSION}`,
      'application/json',
    );
    if (outcome !== 'cancelled') setStatus({ tone: 'info', text: m.batch_exported() });
  };

  const duplicate = async (entry: RecipeListEntry) => {
    const id = await store.duplicate(entry.id, () => m.batch_copy_name({ name: entryName(entry) }));
    await refresh();
    setSelectedId(id);
    setStatus({ tone: 'info', text: m.batch_duplicated() });
  };

  const remove = async (entry: RecipeListEntry) => {
    await store.remove(entry.id);
    await refresh();
    setSelectedId(DEFAULT_ID);
    const restore = entry.recipe;
    setStatus({
      tone: 'info',
      text: m.batch_deleted({ name: entry.recipe.name }),
      undo: () => {
        void store.save(restore, entry.id).then(async () => {
          await refresh();
          setSelectedId(entry.id);
          setStatus(null);
        });
      },
    });
  };

  const saveRename = (id: string) => {
    if (renaming === null || renaming.trim() === '') return;
    void store.rename(id, renaming).then(async () => {
      setRenaming(null);
      await refresh();
    });
  };

  const startRun = () => {
    if (!plan || !canRun || recipe === undefined || selected === undefined) return;
    const controller = new AbortController();
    const initial: RunState = {
      plan,
      controller,
      files: plan.files.map((f) => ({ index: f.index, name: f.name, phase: 'queued' })),
    };
    setRun(initial);
    setView({ kind: 'run' });
    void store.markUsed(selected.id).then(refresh);
    const update = (fn: (state: RunState) => RunState) =>
      setRun((current) => (current?.controller === controller ? fn(current) : current));
    runRecipe(plan, files, {
      values,
      signal: controller.signal,
      askPassword: (request) =>
        new Promise((resolve) => {
          update((state) => ({
            ...state,
            ask: {
              ...request,
              resolve: (answer) => {
                update(({ ask: _done, ...rest }) => rest);
                resolve(answer);
              },
            },
          }));
        }),
      onOcrPrepare: (progress) =>
        update((state) => ({
          ...state,
          preparing:
            progress.phase === 'download' && progress.download
              ? m.batch_run_ocr_download({
                  done: formatBytes(progress.download.done),
                  total: formatBytes(progress.download.total),
                })
              : m.batch_run_ocr_prepare(),
        })),
      onFile: (fileState) =>
        update(({ preparing: _ready, ...state }) => ({
          ...state,
          files: state.files.map((f) => (f.index === fileState.index ? fileState : f)),
        })),
    })
      .then((result) => {
        update((state) => ({ ...state, result }));
        const { totals } = result.report;
        announce(
          m.batch_announce_done({
            done: totals.done + totals.doneWithNotes,
            failed: totals.failed,
          }),
        );
      })
      .catch((error: unknown) => {
        update((state) => ({
          ...state,
          error: error instanceof Error ? error.message : String(error),
        }));
      });
  };

  const recipeFocus: RefObject<HTMLElement | null> = {
    get current() {
      return document.querySelector<HTMLElement>(
        `[data-sheet="${BATCH_SHEET}"] [aria-pressed="true"]`,
      );
    },
  };

  const title =
    view.kind === 'edit'
      ? view.id === undefined
        ? m.batch_new_recipe_title()
        : m.batch_edit_recipe_title()
      : m.batch_title();

  return (
    <Sheet
      id={BATCH_SHEET}
      kind="batch"
      open={open}
      onClose={closeBatchDialog}
      title={title}
      back={view.kind === 'edit' ? () => setView({ kind: 'setup' }) : undefined}
      // S21 §6: focus on the chosen recipe (the popup itself until the list has loaded).
      initialFocus={recipeFocus}
      testId="batch-dialog"
    >
      <div ref={flowRef} className={styles.flow} data-file-drop-zone="">
        {view.kind === 'edit' ? (
          <RecipeEditor
            initial={view.recipe}
            onCancel={() => setView({ kind: 'setup' })}
            onSave={async (saved) => {
              const id = await store.save(saved, view.id);
              await refresh();
              setSelectedId(id);
              setView({ kind: 'setup' });
              setStatus({ tone: 'info', text: m.batch_saved({ name: saved.name }) });
            }}
          />
        ) : null}
        {view.kind === 'run' && run !== null ? (
          <RunView
            run={run}
            onBack={() => {
              setRun(null);
              setView({ kind: 'setup' });
            }}
            onDelivered={(text) => setRun((r) => (r === null ? r : { ...r, delivered: text }))}
          />
        ) : null}
        {view.kind === 'setup' ? (
          <>
            <div className={styles.layout}>
              <aside className={styles.sidebar} aria-label={m.batch_recipes()}>
                <div className={styles.sidebarHead}>
                  <span>{m.batch_recipes()}</span>
                  <span>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => setView({ kind: 'edit', id: undefined, recipe: NEW_RECIPE })}
                    >
                      {m.batch_new()}
                    </button>{' '}
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => importInput.current?.click()}
                    >
                      {m.batch_import()}
                    </button>
                    <input
                      ref={importInput}
                      type="file"
                      accept={`${RECIPE_FILE_EXTENSION},.json,application/json`}
                      className={styles.visuallyHidden}
                      tabIndex={-1}
                      aria-hidden="true"
                      data-testid="batch-import-input"
                      onChange={(event) => {
                        void importRecipe(event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                  </span>
                </div>
                <ul className={styles.list}>
                  <li className={styles.groupLabel}>{m.batch_builtin_group()}</li>
                  {entries
                    .filter((e) => e.builtIn)
                    .map((entry) => (
                      <RecipeRow
                        key={entry.id}
                        entry={entry}
                        selected={entry.id === selected?.id}
                        onSelect={() => setSelectedId(entry.id)}
                      />
                    ))}
                  <li className={styles.groupLabel}>{m.batch_saved_group()}</li>
                  {entries.some((e) => !e.builtIn) ? null : (
                    <li className={`${styles.muted} ${styles.emptyRow}`}>
                      {m.batch_saved_empty()}
                    </li>
                  )}
                  {entries
                    .filter((e) => !e.builtIn)
                    .map((entry) => (
                      <RecipeRow
                        key={entry.id}
                        entry={entry}
                        selected={entry.id === selected?.id}
                        onSelect={() => setSelectedId(entry.id)}
                      />
                    ))}
                </ul>
              </aside>
              <div className={styles.main}>
                <div className={styles.scroll}>
                  {status === null ? null : (
                    <p
                      className={status.tone === 'error' ? styles.error : styles.muted}
                      role={status.tone === 'error' ? 'alert' : 'status'}
                      data-testid="batch-status"
                    >
                      {status.text}{' '}
                      {status.undo ? (
                        <button type="button" className={styles.linkButton} onClick={status.undo}>
                          {m.batch_undo()}
                        </button>
                      ) : null}
                      {status.detail === undefined ? null : (
                        <span className={styles.code}>{status.detail}</span>
                      )}
                    </p>
                  )}
                  {selected !== undefined && summary !== undefined ? (
                    <section className={styles.section} aria-labelledby="batch-recipe-heading">
                      <div className={styles.sectionHead}>
                        {renaming !== null && !selected.builtIn ? (
                          // A group, not a form: it sits in the sheet's form; Enter saves.
                          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                          <div
                            className={tool.row}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') return;
                              event.preventDefault();
                              saveRename(selected.id);
                            }}
                          >
                            <label className={tool.field}>
                              <span className={tool.label}>{m.batch_field_name()}</span>
                              <input
                                className={tool.input}
                                value={renaming}
                                maxLength={120}
                                onChange={(event) => setRenaming(event.target.value)}
                              />
                            </label>
                            <button
                              type="button"
                              className={tool.secondary}
                              onClick={() => saveRename(selected.id)}
                            >
                              {m.batch_rename_save()}
                            </button>
                          </div>
                        ) : (
                          <h3 id="batch-recipe-heading" className={styles.heading}>
                            {entryName(selected)}
                          </h3>
                        )}
                        <span className={styles.inlineActions}>
                          {selected.builtIn ? (
                            <span className={styles.muted}>{m.batch_builtin_readonly()}</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() =>
                                  setView({
                                    kind: 'edit',
                                    id: selected.id,
                                    recipe: selected.recipe,
                                  })
                                }
                              >
                                {m.batch_edit()}
                              </button>
                              <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => setRenaming(selected.recipe.name)}
                              >
                                {m.batch_rename()}
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => void duplicate(selected)}
                          >
                            {m.batch_duplicate()}
                          </button>
                          <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => void exportRecipe(selected)}
                          >
                            {m.batch_export_recipe()}
                          </button>
                          {selected.builtIn ? null : (
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => void remove(selected)}
                            >
                              {m.batch_delete()}
                            </button>
                          )}
                        </span>
                      </div>
                      {entryDescription(selected) ? (
                        <p className={styles.muted}>{entryDescription(selected)}</p>
                      ) : null}
                      <ol className={styles.steps} data-testid="batch-recipe-steps">
                        {summary.steps.map((step) => (
                          <li key={step.index} className={styles.step}>
                            <span className={styles.stepNumber}>{step.index + 1}</span>
                            <span>
                              <span className={styles.stepTitle}>{stepKindLabel(step.kind)}</span>
                              <span className={styles.stepDetail}>{stepDetail(step)}</span>
                              {step.availability.available ? null : (
                                <span className={styles.error}>
                                  {waitingForLabel(step.availability.waitingFor)}
                                </span>
                              )}
                            </span>
                            <span />
                          </li>
                        ))}
                      </ol>
                      <p className={styles.muted}>
                        {m.batch_output_line({ format: outputFormatLabel(summary.output) })}
                      </p>
                    </section>
                  ) : null}

                  <section className={styles.section} aria-labelledby="batch-files-heading">
                    <div className={styles.sectionHead}>
                      <h3 id="batch-files-heading" className={styles.heading}>
                        {m.batch_files()}
                      </h3>
                      {files.length > 0 ? (
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => setFiles([])}
                        >
                          {m.batch_clear_files()}
                        </button>
                      ) : null}
                    </div>
                    <div className={styles.drop} data-over={over ? '' : undefined}>
                      <span>{m.batch_drop_hint()}</span>
                      <button
                        type="button"
                        className={tool.secondary}
                        onClick={() => void pickFiles('pdf').then(addFiles)}
                      >
                        {m.batch_add_files()}
                      </button>
                    </div>
                    {files.length > 0 ? (
                      <ul className={styles.files} data-testid="batch-files">
                        {files.map((file) => {
                          const skip = plan?.skipped.find((s) => s.name === file.name);
                          return (
                            <li key={fileKey(file)} className={styles.file}>
                              <span className={styles.fileName}>{file.name}</span>
                              <span className={styles.fileMeta}>
                                {skip ? skipReasonLabel(skip.reason) : formatBytes(file.size)}
                              </span>
                              <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={m.batch_remove_file({ name: file.name })}
                                title={m.batch_remove_file({ name: file.name })}
                                onClick={() =>
                                  setFiles(files.filter((f) => fileKey(f) !== fileKey(file)))
                                }
                              >
                                <Icon name="x" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </section>

                  {plan !== undefined ? (
                    <ReviewSection
                      plan={plan}
                      passwords={passwords}
                      confirms={confirms}
                      onPassword={(id, value) => setPasswords({ ...passwords, [id]: value })}
                      onConfirm={(id, value) => setConfirms({ ...confirms, [id]: value })}
                    />
                  ) : null}
                </div>
                <div className={styles.footer}>
                  <span className={styles.footerNote}>
                    {backend === 'memory' ? m.batch_storage_memory() : m.batch_storage_local()}
                  </span>
                  <Button variant="standard" onClick={closeBatchDialog}>
                    {m.common_close()}
                  </Button>
                  <button
                    type="button"
                    className={tool.primary}
                    disabled={!canRun}
                    onClick={startRun}
                    data-testid="batch-run"
                  >
                    {plan === undefined
                      ? m.batch_run()
                      : m.batch_run_count({ count: plan.files.length })}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

function importError(error: RecipeError): Status {
  return {
    tone: 'error',
    text: m.batch_import_failed({ reason: recipeErrorText(error) }),
    detail: error.message,
  };
}

function RecipeRow({
  entry,
  selected,
  onSelect,
}: {
  readonly entry: RecipeListEntry;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const steps = m.batch_steps_count({ count: entry.recipe.steps.length });
  const meta =
    entry.lastUsedAt === undefined
      ? steps
      : `${steps} · ${m.batch_last_used({
          date: new Date(entry.lastUsedAt).toLocaleDateString(undefined, {
            dateStyle: 'medium',
          }),
        })}`;
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        aria-pressed={selected}
        onClick={onSelect}
        data-testid="batch-recipe"
      >
        <span className={styles.rowName}>{entryName(entry)}</span>
        <span className={styles.rowMeta}>{meta}</span>
      </button>
    </li>
  );
}

function ReviewSection(props: {
  readonly plan: RecipeRunPlan;
  readonly passwords: Readonly<Record<string, string>>;
  readonly confirms: Readonly<Record<string, string>>;
  readonly onPassword: (id: string, value: string) => void;
  readonly onConfirm: (id: string, value: string) => void;
}) {
  const { plan } = props;
  const baseId = useId();
  const delivery = plan.files.length > 1 ? m.batch_delivery_zip() : m.batch_delivery_single();
  return (
    <section className={styles.section} aria-labelledby={`${baseId}-review`}>
      <h3 id={`${baseId}-review`} className={styles.heading}>
        {m.batch_review()}
      </h3>
      <p className={styles.muted} data-testid="batch-plan">
        {m.batch_plan_line({
          count: plan.files.length,
          size: formatBytes(plan.totalBytes),
          format: outputFormatLabel(plan.output.format),
        })}{' '}
        {plan.files.length > 0 ? delivery : ''}
      </p>
      {plan.skipped.length > 0 ? (
        <ul className={styles.notices}>
          {plan.skipped.map((skip, i) => (
            <li key={`${skip.name}-${i}`} className={styles.muted}>
              {m.batch_skipped_line({ name: skip.name, reason: skipReasonLabel(skip.reason) })}
            </li>
          ))}
        </ul>
      ) : null}
      {plan.blocked.length > 0 ? (
        <ul className={styles.notices} data-testid="batch-blocked">
          {plan.blocked.map((block) => (
            <li key={block.stepIndex} className={styles.notice}>
              {m.batch_blocked_line({
                number: block.stepIndex + 1,
                kind: stepKindLabel(block.kind),
                reason: waitingForLabel(block.waitingFor),
              })}
            </li>
          ))}
        </ul>
      ) : null}
      {plan.files.length === 0 ? <p className={styles.error}>{m.batch_no_files()}</p> : null}
      {plan.inputs.map((input) => {
        const value = props.passwords[input.id] ?? '';
        const confirm = props.confirms[input.id] ?? '';
        const tooLong = utf8ByteLength(value) > input.maxBytes;
        const mismatch = confirm !== '' && confirm !== value;
        return (
          <fieldset key={input.id} className={tool.fieldset}>
            <legend className={tool.legend}>
              {m.batch_password_legend({ number: input.stepIndex + 1 })}
            </legend>
            <p className={styles.muted}>{m.batch_password_hint()}</p>
            <div className={tool.row}>
              <label className={tool.field}>
                <span className={tool.label}>{m.batch_password()}</span>
                <input
                  className={tool.input}
                  type="password"
                  autoComplete="new-password"
                  value={value}
                  aria-invalid={tooLong}
                  onChange={(event) => props.onPassword(input.id, event.target.value)}
                />
              </label>
              <label className={tool.field}>
                <span className={tool.label}>{m.batch_password_confirm()}</span>
                <input
                  className={tool.input}
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  aria-invalid={mismatch}
                  onChange={(event) => props.onConfirm(input.id, event.target.value)}
                />
              </label>
            </div>
            {tooLong ? <p className={styles.error}>{m.batch_password_too_long()}</p> : null}
            {mismatch ? <p className={styles.error}>{m.batch_password_mismatch()}</p> : null}
          </fieldset>
        );
      })}
    </section>
  );
}

function phaseText(state: BatchFileState, plan: RecipeRunPlan): string {
  switch (state.phase) {
    case 'queued':
      return m.batch_phase_queued();
    case 'opening':
      return m.batch_phase_opening();
    case 'steps': {
      const step = plan.recipe.steps[state.stepIndex ?? 0];
      if (state.ocr !== undefined) {
        return m.batch_phase_ocr({
          number: (state.stepIndex ?? 0) + 1,
          total: plan.recipe.steps.length,
          done: state.ocr.done,
          pages: state.ocr.total,
        });
      }
      return m.batch_phase_step({
        number: (state.stepIndex ?? 0) + 1,
        total: plan.recipe.steps.length,
        kind: step ? stepKindLabel(step.kind) : '',
      });
    }
    case 'exporting':
      if (state.exportPhase === 'verifying') return m.batch_phase_verifying();
      return plan.output.format === 'markdown' || plan.output.format === 'text'
        ? m.batch_phase_converting()
        : m.batch_phase_exporting();
    case 'done':
      return m.batch_phase_done();
    case 'done-with-notes':
      return m.batch_phase_done_notes();
    case 'failed':
      return state.outcome?.failure
        ? m.batch_phase_failed({ reason: failureReasonLabel(state.outcome.failure.reason) })
        : m.batch_phase_failed({ reason: '' });
    case 'skipped':
      return state.outcome?.skipReason
        ? skipReasonLabel(state.outcome.skipReason)
        : m.batch_phase_skipped();
  }
}

function toneOf(state: BatchFileState): string | undefined {
  switch (state.phase) {
    case 'done':
      return 'done';
    case 'done-with-notes':
      return 'notes';
    case 'failed':
      return 'failed';
    default:
      return undefined;
  }
}

function RunView({
  run,
  onBack,
  onDelivered,
}: {
  readonly run: RunState;
  readonly onBack: () => void;
  readonly onDelivered: (text: string) => void;
}) {
  const { plan, result } = run;
  const [answer, setAnswer] = useState('');
  const passwordInput = useRef<HTMLInputElement>(null);
  const asking = run.ask !== undefined;
  const submitAnswer = () => {
    const value = answer;
    setAnswer('');
    run.ask?.resolve(value);
  };
  // The run waits for this answer: take the focus to it.
  useEffect(() => {
    if (asking) passwordInput.current?.focus();
  }, [asking, run.ask?.fileName]);
  const [delivering, setDelivering] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const finished = result !== undefined || run.error !== undefined;
  const settled = run.files.filter((f) =>
    ['done', 'done-with-notes', 'failed', 'skipped'].includes(f.phase),
  ).length;
  const outputs = result?.outputs ?? [];

  const deliver = async (how: 'zip' | 'files' | 'folder') => {
    if (result === undefined) return;
    setDelivering(true);
    setDeliveryError(null);
    try {
      if (how === 'zip') {
        const name = zipName(plan.recipe.name);
        const outcome = await deliverZip(outputs, name);
        if (outcome !== 'cancelled') onDelivered(m.batch_delivered_zip({ name }));
      } else if (how === 'files') {
        const outcome = await deliverEach(outputs);
        if (outcome !== 'cancelled')
          onDelivered(m.batch_delivered_files({ count: outputs.length }));
      } else {
        const outcome = await deliverToFolder(outputs);
        if (outcome !== 'cancelled')
          onDelivered(m.batch_delivered_folder({ count: outputs.length }));
      }
    } catch (error) {
      setDeliveryError(
        m.batch_delivery_failed({ reason: error instanceof Error ? error.message : String(error) }),
      );
    } finally {
      setDelivering(false);
    }
  };

  const totals = result?.report.totals;
  return (
    <>
      <div className={styles.scroll} data-testid="batch-run-view">
        <div className={styles.section}>
          <p className={styles.muted} role="status" data-testid="batch-run-status">
            {totals !== undefined
              ? m.batch_run_summary({
                  done: totals.done + totals.doneWithNotes,
                  notes: totals.doneWithNotes,
                  failed: totals.failed,
                  skipped: totals.skipped,
                })
              : (run.error ??
                run.preparing ??
                m.batch_run_progress({ done: settled, total: plan.files.length }))}
          </p>
          <progress
            className={tool.progress}
            max={Math.max(1, plan.files.length)}
            value={settled}
            aria-label={m.batch_run_progress_label()}
          />
        </div>
        {run.ask !== undefined ? (
          // A group, not a form: it sits in the sheet's form; Enter opens the file.
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div
            className={styles.prompt}
            data-testid="batch-password-prompt"
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return;
              event.preventDefault();
              submitAnswer();
            }}
          >
            <p className={styles.heading}>{m.batch_source_password({ name: run.ask.fileName })}</p>
            {run.ask.incorrect ? (
              <p className={styles.error} role="alert">
                {m.batch_source_password_incorrect()}
              </p>
            ) : null}
            <div className={tool.row}>
              <label className={tool.field}>
                <span className={tool.label}>{m.batch_password()}</span>
                <input
                  className={tool.input}
                  type="password"
                  autoComplete="off"
                  value={answer}
                  ref={passwordInput}
                  onChange={(event) => setAnswer(event.target.value)}
                />
              </label>
            </div>
            <div className={tool.actions}>
              <button
                type="button"
                className={tool.secondary}
                onClick={() => {
                  setAnswer('');
                  run.ask?.resolve(null);
                }}
              >
                {m.batch_skip_file()}
              </button>
              <button type="button" className={tool.primary} onClick={submitAnswer}>
                {m.batch_open_file()}
              </button>
            </div>
          </div>
        ) : null}
        <ol className={styles.progressList} data-testid="batch-progress">
          {run.files.map((state) => {
            const outcome = state.outcome;
            return (
              <li key={state.index} className={styles.progressRow} data-testid="batch-file-row">
                <div className={styles.progressHead}>
                  <span className={styles.fileName}>{state.name}</span>
                  <span className={styles.status} data-tone={toneOf(state)}>
                    {phaseText(state, plan)}
                  </span>
                </div>
                {outcome?.outputName !== undefined ? (
                  <span className={styles.muted}>
                    {m.batch_output_file({
                      name: outcome.outputName,
                      size: formatBytes(outcome.outputBytes ?? 0),
                    })}
                  </span>
                ) : null}
                {outcome?.failure !== undefined ? (
                  <span className={styles.error}>
                    {outcome.failure.stepIndex === undefined
                      ? outcome.failure.message
                      : m.batch_failure_at_step({
                          number: outcome.failure.stepIndex + 1,
                          message: outcome.failure.message,
                        })}
                  </span>
                ) : null}
                {outcome !== undefined && outcome.notices.length > 0 ? (
                  <ul className={styles.notices}>
                    {outcome.notices.map((notice, i) => (
                      <li key={`${notice.code}-${i}`} className={styles.notice}>
                        {notice.stepIndex === undefined || notice.kind === undefined
                          ? notice.message
                          : m.batch_notice_at_step({
                              number: notice.stepIndex + 1,
                              kind: stepKindLabel(notice.kind),
                              message: notice.message,
                            })}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
        {run.delivered === undefined ? null : (
          <p className={styles.muted} role="status">
            {run.delivered}
          </p>
        )}
        {deliveryError === null ? null : (
          <p className={styles.error} role="alert">
            {deliveryError}
          </p>
        )}
      </div>
      <div className={styles.footer}>
        <span className={styles.footerNote}>
          {finished
            ? outputs.length === 0
              ? m.batch_no_outputs()
              : m.batch_outputs_ready({
                  count: outputs.length,
                  size: formatBytes(totalSize(outputs)),
                })
            : m.batch_running_note()}
        </span>
        {finished ? (
          <>
            <button type="button" className={tool.secondary} onClick={onBack}>
              {m.common_back()}
            </button>
            {outputs.length > 1 ? (
              <>
                {supportsFolderDelivery() ? (
                  <button
                    type="button"
                    className={tool.secondary}
                    disabled={delivering}
                    onClick={() => void deliver('folder')}
                  >
                    {m.batch_save_folder()}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={tool.secondary}
                  disabled={delivering}
                  onClick={() => void deliver('files')}
                >
                  {m.batch_download_files()}
                </button>
                <button
                  type="button"
                  className={tool.primary}
                  disabled={delivering}
                  onClick={() => void deliver('zip')}
                  data-testid="batch-download-zip"
                >
                  {m.batch_download_zip()}
                </button>
              </>
            ) : outputs.length === 1 ? (
              <button
                type="button"
                className={tool.primary}
                disabled={delivering}
                onClick={() => void deliver('files')}
                data-testid="batch-download"
              >
                {m.batch_download()}
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className={tool.secondary}
            onClick={() => {
              run.controller.abort();
              run.ask?.resolve(null);
            }}
            data-testid="batch-cancel"
          >
            {m.common_cancel()}
          </button>
        )}
      </div>
    </>
  );
}

function totalSize(outputs: BatchRunResult['outputs']): number {
  return outputs.reduce((sum, o) => sum + o.entry.data.size, 0);
}
