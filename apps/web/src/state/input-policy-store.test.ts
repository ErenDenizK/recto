/**
 * The input policy's device settings (redesign spec §7; craft spec §3.5 before it): "Pen
 * draws in Markup" turns on the first time a pen is seen, unless already chosen; the one-time
 * hint is remembered; every field persists and is validated field by field; M8's
 * `edit-policy:v1` is migrated once.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_INPUT_POLICY,
  INPUT_POLICY_STORAGE_KEY,
  LEGACY_EDIT_POLICY_STORAGE_KEY,
  loadInputPolicy,
  migrateEditPolicy,
  parseInputPolicy,
  penDrawsInMarkup,
  resetInputPolicyStore,
  useInputPolicyStore,
} from './input-policy-store';

afterEach(() => {
  resetInputPolicyStore();
  localStorage.removeItem(INPUT_POLICY_STORAGE_KEY);
  localStorage.removeItem(LEGACY_EDIT_POLICY_STORAGE_KEY);
});

const stored = () =>
  JSON.parse(localStorage.getItem(INPUT_POLICY_STORAGE_KEY) ?? 'null') as unknown;

describe('input policy settings', () => {
  it('defaults (§7, owner question 1): auto, nothing without Markup, unlocked, hint unseen', () => {
    expect(DEFAULT_INPUT_POLICY).toEqual({
      penDrawsInMarkup: 'auto',
      penWritesWithoutMarkup: false,
      drawWithFinger: 'auto',
      openDocumentsLocked: false,
      keepToolsVisible: false,
      editTextHintShown: false,
      penHintShown: false,
    });
    expect(parseInputPolicy(undefined)).toEqual(DEFAULT_INPUT_POLICY);
  });

  it('parses field by field', () => {
    expect(
      parseInputPolicy({
        penDrawsInMarkup: false,
        penWritesWithoutMarkup: true,
        drawWithFinger: false,
        openDocumentsLocked: true,
        keepToolsVisible: true,
        editTextHintShown: true,
        penHintShown: true,
      }),
    ).toEqual({
      penDrawsInMarkup: false,
      penWritesWithoutMarkup: true,
      drawWithFinger: false,
      openDocumentsLocked: true,
      keepToolsVisible: true,
      editTextHintShown: true,
      penHintShown: true,
    });
    expect(
      parseInputPolicy({
        penDrawsInMarkup: 'yes',
        penWritesWithoutMarkup: 'auto',
        drawWithFinger: 1,
        openDocumentsLocked: null,
        keepToolsVisible: 'on',
        editTextHintShown: 1,
        penHintShown: 'once',
      }),
    ).toEqual(DEFAULT_INPUT_POLICY);
    expect(parseInputPolicy([true])).toEqual(DEFAULT_INPUT_POLICY);
    // M8's field name is not an input-policy field.
    expect(parseInputPolicy({ penDrawsInEdit: true }).penDrawsInMarkup).toBe('auto');
  });

  it('auto draws only once a pen has been seen; a choice wins', () => {
    expect(penDrawsInMarkup({ penDrawsInMarkup: 'auto' }, false)).toBe(false);
    expect(penDrawsInMarkup({ penDrawsInMarkup: 'auto' }, true)).toBe(true);
    expect(penDrawsInMarkup({ penDrawsInMarkup: false }, true)).toBe(false);
    expect(penDrawsInMarkup({ penDrawsInMarkup: true }, false)).toBe(true);
  });

  it('the first pen turns auto on and it is remembered; an explicit off stays off', () => {
    useInputPolicyStore.getState().notePen();
    expect(useInputPolicyStore.getState().penDrawsInMarkup).toBe(true);
    expect(stored()).toEqual({ ...DEFAULT_INPUT_POLICY, penDrawsInMarkup: true });

    useInputPolicyStore.getState().setPenDrawsInMarkup(false);
    useInputPolicyStore.getState().notePen();
    expect(useInputPolicyStore.getState().penDrawsInMarkup).toBe(false);
    expect(stored()).toEqual({ ...DEFAULT_INPUT_POLICY, penDrawsInMarkup: false });
  });

  it('the hint, once shown to its end, is remembered', () => {
    useInputPolicyStore.getState().markEditTextHintShown();
    expect(useInputPolicyStore.getState().editTextHintShown).toBe(true);
    expect(stored()).toEqual({ ...DEFAULT_INPUT_POLICY, editTextHintShown: true });
  });
});

describe('edit-policy:v1 → input-policy:v1 migration (§7)', () => {
  it.each([
    ['auto', false],
    ['auto', true],
    [true, false],
    [true, true],
    [false, false],
    [false, true],
  ] as const)('carries penDrawsInEdit %s and the hint %s', (pen, hint) => {
    expect(migrateEditPolicy({ penDrawsInEdit: pen, editTextHintShown: hint })).toEqual({
      ...DEFAULT_INPUT_POLICY,
      penDrawsInMarkup: pen,
      editTextHintShown: hint,
    });
  });

  it('gives the defaults for garbage, field by field', () => {
    for (const value of [undefined, null, 42, 'x', [], {}]) {
      expect(migrateEditPolicy(value)).toEqual(DEFAULT_INPUT_POLICY);
    }
    expect(migrateEditPolicy({ penDrawsInEdit: 'yes', editTextHintShown: true })).toEqual({
      ...DEFAULT_INPUT_POLICY,
      editTextHintShown: true,
    });
  });

  it('migrates once and then reads input-policy:v1', () => {
    expect(loadInputPolicy()).toEqual(DEFAULT_INPUT_POLICY);
    expect(stored()).toBeNull();

    localStorage.setItem(
      LEGACY_EDIT_POLICY_STORAGE_KEY,
      JSON.stringify({ penDrawsInEdit: false, editTextHintShown: true }),
    );
    const migrated = { ...DEFAULT_INPUT_POLICY, penDrawsInMarkup: false, editTextHintShown: true };
    expect(loadInputPolicy()).toEqual(migrated);
    expect(stored()).toEqual(migrated);
    // A later v1 write (an old tab) does not migrate again.
    localStorage.setItem(
      LEGACY_EDIT_POLICY_STORAGE_KEY,
      JSON.stringify({ penDrawsInEdit: true, editTextHintShown: false }),
    );
    expect(loadInputPolicy()).toEqual(migrated);
  });
});
