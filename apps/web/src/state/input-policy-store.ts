/**
 * The input policy, per device (redesign spec §7, flows §2.4; craft spec §3.5 before it):
 * which input may create on the page, and when. Today's `edit-policy-store`, renamed with
 * M9's words; Settings shows the rows it has (family 15).
 *
 * - **"Pen draws in Markup"** (`penDrawsInMarkup`, M8's "Pen draws in Edit"): `'auto'` until
 *   a pen is first seen, which turns it on (`notePen`); then on or off as the person
 *   chooses. While on, a pen touching the page with Select armed draws with the armed preset
 *   and never hit-tests text, and a pen double-click never opens the text editor.
 * - **"Pen writes without Markup"** (`penWritesWithoutMarkup`, flows §3.4): off.
 * - **"Draw with finger"** (`drawWithFinger`, research 19 M-25): `'auto'`, on before a pen
 *   and off after.
 * - **"Open documents locked"** (`openDocumentsLocked`, ADR-0029 §2.6's `default` reason):
 *   off, the owner's answer to question 1 (redesign spec §14).
 * - **"Keep tools visible"** (`keepToolsVisible`, `01-frame` F12): off, so the compact
 *   chrome may hide on scroll.
 * - **The one-time hint** (`editTextHintShown`): "Double-click to edit text" shows with the
 *   idle hover outline until the first double-click into the editor, and never again.
 *
 * Persisted in `pdf-editor:input-policy:v1`, validated field by field. The M8 record
 * `pdf-editor:edit-policy:v1` is migrated once (`penDrawsInEdit` becomes `penDrawsInMarkup`;
 * the hint carries over); the new fields start at their defaults.
 */
import { create } from 'zustand';

import { readJson, writeJson } from './safe-storage';

export const INPUT_POLICY_STORAGE_KEY = 'pdf-editor:input-policy:v1';
/** M8's record (`edit-policy-store`), read once when `input-policy:v1` is missing. */
export const LEGACY_EDIT_POLICY_STORAGE_KEY = 'pdf-editor:edit-policy:v1';

/** `'auto'` until a choice or the first pen; the M8 "Pen draws in Edit". */
export type PenDrawsInMarkup = 'auto' | boolean;
/** `'auto'`: a finger draws until a pen is seen (research 19 M-25). */
export type DrawWithFinger = 'auto' | boolean;

export interface InputPolicySettings {
  readonly penDrawsInMarkup: PenDrawsInMarkup;
  readonly penWritesWithoutMarkup: boolean;
  readonly drawWithFinger: DrawWithFinger;
  readonly openDocumentsLocked: boolean;
  readonly keepToolsVisible: boolean;
  readonly editTextHintShown: boolean;
}

export const DEFAULT_INPUT_POLICY: InputPolicySettings = {
  penDrawsInMarkup: 'auto',
  penWritesWithoutMarkup: false,
  drawWithFinger: 'auto',
  openDocumentsLocked: false,
  keepToolsVisible: false,
  editTextHintShown: false,
};

const FIELDS = Object.keys(DEFAULT_INPUT_POLICY) as readonly (keyof InputPolicySettings)[];

interface InputPolicyState extends InputPolicySettings {
  setPenDrawsInMarkup(on: boolean): void;
  /** A pen was seen: "auto" becomes on (a choice already made stays). */
  notePen(): void;
  /** The hint has done its job (the first double-click into the editor). */
  markEditTextHintShown(): void;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const autoOrBoolean = (value: unknown, fallback: 'auto' | boolean): 'auto' | boolean =>
  value === 'auto' || typeof value === 'boolean' ? value : fallback;
const boolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/** Stored settings, field by field: anything unexpected falls back to the default. */
export function parseInputPolicy(value: unknown): InputPolicySettings {
  const r = record(value);
  const d = DEFAULT_INPUT_POLICY;
  return {
    penDrawsInMarkup: autoOrBoolean(r.penDrawsInMarkup, d.penDrawsInMarkup),
    penWritesWithoutMarkup: boolean(r.penWritesWithoutMarkup, d.penWritesWithoutMarkup),
    drawWithFinger: autoOrBoolean(r.drawWithFinger, d.drawWithFinger),
    openDocumentsLocked: boolean(r.openDocumentsLocked, d.openDocumentsLocked),
    keepToolsVisible: boolean(r.keepToolsVisible, d.keepToolsVisible),
    editTextHintShown: boolean(r.editTextHintShown, d.editTextHintShown),
  };
}

/**
 * `edit-policy:v1` → `input-policy:v1`: "Pen draws in Edit" becomes "Pen draws in Markup"
 * (its value, `'auto'` included, carries over) and the hint carries over; every other field
 * starts at its default. Garbage gives the defaults.
 */
export function migrateEditPolicy(v1: unknown): InputPolicySettings {
  const r = record(v1);
  return {
    ...DEFAULT_INPUT_POLICY,
    penDrawsInMarkup: autoOrBoolean(r.penDrawsInEdit, DEFAULT_INPUT_POLICY.penDrawsInMarkup),
    editTextHintShown: boolean(r.editTextHintShown, DEFAULT_INPUT_POLICY.editTextHintShown),
  };
}

/** Reads `input-policy:v1`, or migrates `edit-policy:v1` once (the result is written). */
export function loadInputPolicy(): InputPolicySettings {
  const stored = readJson(INPUT_POLICY_STORAGE_KEY);
  if (stored !== undefined) return parseInputPolicy(stored);
  const legacy = readJson(LEGACY_EDIT_POLICY_STORAGE_KEY);
  if (legacy === undefined) return DEFAULT_INPUT_POLICY;
  const settings = migrateEditPolicy(legacy);
  writeJson(INPUT_POLICY_STORAGE_KEY, settings);
  return settings;
}

export const useInputPolicyStore = create<InputPolicyState>()((set, get) => ({
  ...loadInputPolicy(),
  setPenDrawsInMarkup: (on) => set({ penDrawsInMarkup: on }),
  notePen: () => {
    if (get().penDrawsInMarkup === 'auto') set({ penDrawsInMarkup: true });
  },
  markEditTextHintShown: () => {
    if (!get().editTextHintShown) set({ editTextHintShown: true });
  },
}));

useInputPolicyStore.subscribe((state, previous) => {
  if (FIELDS.every((field) => state[field] === previous[field])) return;
  const settings = Object.fromEntries(FIELDS.map((field) => [field, state[field]]));
  writeJson(INPUT_POLICY_STORAGE_KEY, settings);
});

/** Whether a pen draws with Select armed: on, or still "auto" once a pen has been seen. */
export function penDrawsInMarkup(
  settings: Pick<InputPolicySettings, 'penDrawsInMarkup'>,
  penSeen: boolean,
): boolean {
  return settings.penDrawsInMarkup === true || (settings.penDrawsInMarkup === 'auto' && penSeen);
}

/** Tests: back to the defaults (or `settings`). */
export function resetInputPolicyStore(settings: Partial<InputPolicySettings> = {}): void {
  useInputPolicyStore.setState({ ...DEFAULT_INPUT_POLICY, ...settings });
}
