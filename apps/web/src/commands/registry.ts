/**
 * The command registry. Every user-facing action is a command: it appears in the command
 * palette and the shortcut overlay, and may be bound to a shortcut (DESIGN.md §4.1).
 *
 * Every command declares the kind of change it makes, its `act` (ADR-0030 §2.3; redesign spec
 * §7), or `null` when it changes no document. The registry asks the change guard
 * (`state/guard.ts`) for each document the command changes, so a command on a locked document,
 * or a drawing command outside Markup, is dimmed with the guard's reason in the palette, the
 * menus and the bars rather than hidden (RA-21). `registry.test.ts` walks every command the app
 * registers and fails on one that declares no act.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { type Act, type ChangeRefusal, changeRefusal, isAct, refusalReason } from '../state/guard';
import { lazyModule } from '../motion/lazy';
import { useWorkspaceStore } from '../state/workspace-store';
import { type ParsedShortcut, parseShortcut } from './shortcuts';

/**
 * How a command reaches its act when the command itself does not make it:
 *
 * - `markup`: it opens Markup before it acts (a Markup door, ADR-0029 §2.2: a tool key, a
 *   placing tool), so a `freehand` or `place` act needs only an unlocked document.
 * - `sheet`: it opens a sheet whose primary makes the act. A locked sheet still opens and
 *   previews, with its lock banner, and its primary asks the guard (07-sheets §1.4; D1-8), so
 *   the command itself is not dimmed.
 */
export type CommandVia = 'markup' | 'sheet';

export interface CommandDefinition {
  /** Stable, namespaced id, e.g. `file.open`. */
  readonly id: string;
  readonly title: string;
  /** Palette and overlay group heading, e.g. `File`, `View`. */
  readonly group: string;
  /**
   * The kind of change the command makes (ADR-0030 §2.2–§2.3), or `null` for a command that
   * changes no document: views, panels and settings; opening files; Save, Save a copy and
   * other outputs; Compare; Combine and Interleave, which read their sources (X32); closing a
   * tab (X12); Undo, Redo and History (ADR-0030 §2.7). Required, so that every command says.
   */
  readonly act: Act | null;
  /** How the act is reached when the command does not make it directly. */
  readonly via?: CommandVia;
  /**
   * The documents the act changes, each asked separately (ADR-0030 §2.4): the pages'
   * documents for a page command, the section's for a section command, both ends of a move.
   * Default: the active document. None (an empty list) fails closed.
   */
  readonly documents?: () => readonly DocumentId[];
  /**
   * Why the command is unavailable while `when` says no ("Nothing changed since opening"),
   * shown beside the dimmed item. The guard's refusals carry their own reason.
   */
  readonly reason?: () => string | undefined;
  /** One shortcut, or several; the first is the one displayed. */
  readonly shortcut?: string | readonly string[];
  /**
   * Extra search terms for the palette. The registry adds the command's catalog keywords
   * (`cmd_<id>_keywords`, every UI language; see `keywords.ts`).
   */
  readonly keywords?: readonly string[];
  /** Short note shown in the shortcut overlay, e.g. browser caveats. */
  readonly note?: string;
  /**
   * Let the shortcut fire while focus is in a text field or inside a modal dialog. Off by
   * default so typing "1" in the palette never switches the view mode.
   */
  readonly allowInInputs?: boolean;
  /** Keep the command in the overlay but out of the palette (e.g. "Toggle palette"). */
  readonly hiddenInPalette?: boolean;
  readonly run: () => void | Promise<void>;
  /** Availability predicate; unavailable commands do not run and are dimmed in lists. */
  readonly when?: () => boolean;
}

export interface Command extends CommandDefinition {
  readonly shortcuts: readonly ParsedShortcut[];
}

type Listener = () => void;

/**
 * The catalog keywords (`keywords.ts`): a lookup by key that reads every message in every UI
 * language, so it loads after the first paint, when the first command registers, instead of
 * pulling the whole catalog into the editor's first load (PLAN.md §2.3 V1-P2). The registry
 * adds them to every command once they are here, long before a palette search can run.
 */
const keywordCatalog = lazyModule(() => import('./keywords'));

export class CommandRegistry {
  private readonly byId = new Map<string, Command>();
  private readonly listeners = new Set<Listener>();
  private snapshot: readonly Command[] = [];
  /** What each registration passed, to add the catalog keywords once they load. */
  private readonly definitions = new Map<string, CommandDefinition>();
  private keywordsLoading: Promise<void> | null = null;

  register(definition: CommandDefinition): () => void {
    if (this.byId.has(definition.id)) {
      throw new Error(`Command "${definition.id}" is already registered`);
    }
    // Fails loudly, as a duplicate id does: a command that might commit must say what it
    // changes, or the guard cannot dim it (ADR-0030 §2.3).
    if (definition.act !== null && !isAct(definition.act)) {
      throw new Error(`Command "${definition.id}" declares no act (an Act, or null)`);
    }
    this.definitions.set(definition.id, definition);
    this.byId.set(definition.id, this.build(definition));
    this.emit();
    if (!keywordCatalog.now()) this.loadKeywords();
    return () => {
      if (this.definitions.get(definition.id) === definition) {
        this.definitions.delete(definition.id);
        this.byId.delete(definition.id);
        this.emit();
      }
    };
  }

  /** Resolves once the catalog keywords are on every registered command (tests, the palette). */
  keywordsLoaded(): Promise<void> {
    return this.keywordsLoading ?? Promise.resolve();
  }

  private loadKeywords(): void {
    this.keywordsLoading ??= keywordCatalog.load().then(
      () => {
        this.keywordsLoading = null;
        for (const [id, definition] of this.definitions) this.byId.set(id, this.build(definition));
        this.emit();
      },
      () => {
        this.keywordsLoading = null;
      },
    );
  }

  /** The command for `definition`: its parsed shortcuts and, once loaded, catalog keywords. */
  private build(definition: CommandDefinition): Command {
    const raw = definition.shortcut;
    const list: readonly string[] = raw === undefined ? [] : typeof raw === 'string' ? [raw] : raw;
    const catalog = keywordCatalog.now()?.messageKeywords(definition.id) ?? [];
    const keywords =
      catalog.length === 0
        ? definition.keywords
        : [...new Set([...(definition.keywords ?? []), ...catalog])];
    return {
      ...definition,
      ...(keywords === undefined ? {} : { keywords }),
      shortcuts: list.map(parseShortcut),
    };
  }

  get(id: string): Command | undefined {
    return this.byId.get(id);
  }

  /** Commands in registration order. The array identity changes only on mutation. */
  list(): readonly Command[] {
    return this.snapshot;
  }

  /**
   * The guard's refusal of the command's act now (ADR-0030 §2.3), for the first of its
   * documents that refuses, or undefined when the act may happen. A command with no act, or
   * one that reaches it through a sheet, is never refused here.
   */
  refusalOf(command: Command): ChangeRefusal | undefined {
    const { act } = command;
    if (act === null || command.via === 'sheet') return undefined;
    const documents = command.documents ? command.documents() : activeDocuments();
    if (documents.length === 0) return { kind: 'unknown' };
    const context = command.via === 'markup' ? { opensMarkup: true } : undefined;
    for (const id of documents) {
      const refusal = changeRefusal(id, act, context);
      if (refusal !== undefined) return refusal;
    }
    return undefined;
  }

  /** Whether the command may run now: its `when`, and the guard for its act. */
  isEnabled(command: Command): boolean {
    try {
      if (command.when && !command.when()) return false;
      return this.refusalOf(command) === undefined;
    } catch {
      return false;
    }
  }

  /**
   * Why a dimmed command cannot run, for the item's reason line or description: its own
   * `reason` while `when` says no, else the guard's ("Locked · unlock first"). Undefined while
   * it can run, or when nothing says why.
   */
  disabledReason(command: Command): string | undefined {
    try {
      if (command.when && !command.when()) return command.reason?.();
      const refusal = this.refusalOf(command);
      return refusal === undefined ? undefined : refusalReason(refusal);
    } catch {
      return undefined;
    }
  }

  /** Runs a command if it exists and is enabled. Resolves to whether it ran. */
  async execute(id: string): Promise<boolean> {
    const command = this.byId.get(id);
    if (!command || !this.isEnabled(command)) return false;
    await command.run();
    return true;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(): void {
    this.snapshot = [...this.byId.values()];
    for (const listener of this.listeners) listener();
  }
}

/** The active document, as the documents a command changes by default. */
function activeDocuments(): readonly DocumentId[] {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  return id === undefined ? [] : [id];
}

/** Groups commands preserving the order in which groups first appear. */
export function groupCommands<T extends { group: string }>(
  commands: readonly T[],
): { group: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const command of commands) {
    const items = groups.get(command.group);
    if (items) items.push(command);
    else groups.set(command.group, [command]);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}

/** The application-wide registry. */
export const commandRegistry = new CommandRegistry();

export function registerCommand(definition: CommandDefinition): () => void {
  return commandRegistry.register(definition);
}
