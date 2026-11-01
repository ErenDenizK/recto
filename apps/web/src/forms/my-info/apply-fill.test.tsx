/**
 * Applying a My info plan (BM-4, L3), Vitest browser mode with the real stores and PDFium:
 * one undo step "Fill from My info" over engine and created fields, the lock (PRD-38), pages
 * re-rendering, one field alone, stale plans refused, and the hand-versus-My-info origin.
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import {
  getActiveDocument,
  historyEntries,
  type PageId,
  type SourceId,
} from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import formsAUrl from '../../../../../test/fixtures/forms-a.pdf?url';
import { enterEditMode, fixtureFile } from '../../../test/store-harness';
import { resetAnnotationStore } from '../../annotations/annotation-store';
import { engineContext, resetEditRunner, whenIdle } from '../../annotations/edit-runner';
import { getEngineService } from '../../engine/engine-service';
import { resetLockStore, useLockStore } from '../../state/lock-store';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { useToolStore } from '../../viewer/tool-store';
import { addField, fillCreatedFields, updateField } from '../create/field-actions';
import { resetCreateStore } from '../create/create-store';
import { commitFieldValue } from '../actions';
import { fieldStops, isFillable, resetFormStore, useFormStore } from '../form-store';
import { clearActiveForm, fillActiveFormFromMyInfo } from '../index';
import { forgetMyInfo, memoryMyInfoBackend, setMyInfoBackend, useMyInfo } from './my-info';
import { createFillPlan } from './apply-fill';
import { originOf, resetFillOrigins } from './fill-origin';
import type * as FieldActions from '../create/field-actions';
import { type MyInfo, planFill } from './plan-fill';

vi.mock('../create/field-actions', async (importOriginal) => {
  const real = await importOriginal<typeof FieldActions>();
  return { ...real, fillCreatedFields: vi.fn(real.fillCreatedFields) };
});

const INFO: MyInfo = { givenName: 'Ayşe', familyName: 'Yılmaz', email: 'ayse@example.com' };
const model = () => useWorkspaceStore.getState();
const labels = () => historyEntries(model().history).map((e) => e.label);
const doc = () => {
  const d = getActiveDocument(model().workspace);
  if (!d) throw new Error('no document');
  return d;
};

beforeEach(() => {
  setMyInfoBackend(memoryMyInfoBackend());
  resetWorkspace();
  resetFormStore();
  resetEditRunner();
  resetAnnotationStore();
  resetCreateStore();
  resetLockStore();
  resetFillOrigins();
  useToolStore.setState({ mode: 'select' });
});
afterEach(async () => {
  setMyInfoBackend(undefined);
  await whenIdle();
  vi.restoreAllMocks();
});

async function reloadStops() {
  await whenIdle();
  const d = doc();
  const sources = new Set<SourceId>();
  for (const p of d.pages) if (p.ref.kind === 'source') sources.add(p.ref.source);
  for (const s of sources) {
    await useFormStore.getState().reloadSource(s);
  }
  return fieldStops(d, useFormStore.getState().sources).filter((s) => isFillable(s.field));
}

const planOf = async (info: MyInfo = INFO) =>
  createFillPlan(planFill(await reloadStops(), info, { locale: 'en' }));

async function values(source: SourceId): Promise<Record<string, unknown>> {
  const { editor } = await engineContext();
  return Object.fromEntries((await editor.listFormFields(source)).map((f) => [f.name, f.value]));
}

/** forms-a emptied, with a created "Email" field on its first page. */
async function openCleared() {
  await model().openFiles([await fixtureFile(formsAUrl, 'forms-a.pdf')]);
  enterEditMode();
  await clearActiveForm();
  const d = doc();
  const ref = d.pages[0]?.ref;
  if (ref?.kind !== 'source') throw new Error('no source');
  const page = d.pages[0]?.id as PageId;
  const id = addField('text', page, { x: 100, y: 100, width: 200, height: 20 });
  if (!id) throw new Error('no field');
  updateField(id, { name: 'Email' });
  return { source: ref.source, id, documentId: d.id };
}

describe('applyFillPlan', () => {
  it('fills engine and created fields as one step; one undo clears all, redo restores', async () => {
    const { source, id } = await openCleared();
    const plan = await planOf();
    expect(plan?.items.map((i) => i.name)).toContain('name');
    expect(plan?.items.some((i) => i.fieldId === id)).toBe(true);
    const before = labels().length;
    if (!plan) throw new Error('no plan');
    const outcome = await fillActiveFormFromMyInfo(plan);
    await whenIdle();
    expect(outcome.status).toBe('filled');
    expect(outcome.filled).toBe(plan.items.length);
    // Engine and created fields coalesced into one history step.
    expect(labels().length).toBe(before + 1);
    expect(labels().at(-1)).toBe('Fill from My info');
    expect((await values(source)).name).toBe('Ayşe Yılmaz');
    expect(doc().fields?.find((f) => f.id === id)?.value).toBe('ayse@example.com');

    model().undo();
    await whenIdle();
    expect((await values(source)).name).toBe('');
    expect(doc().fields?.find((f) => f.id === id)?.value ?? '').toBe('');
    model().redo();
    await whenIdle();
    expect((await values(source)).name).toBe('Ayşe Yılmaz');
    expect(doc().fields?.find((f) => f.id === id)?.value).toBe('ayse@example.com');
  });

  it('refuses a locked document and changes nothing', async () => {
    const { source, documentId } = await openCleared();
    const plan = await planOf();
    if (!plan) throw new Error('no plan');
    useLockStore.getState().lock(documentId);
    const before = labels().length;
    expect(await fillActiveFormFromMyInfo(plan)).toEqual({ status: 'locked', filled: 0 });
    expect(labels().length).toBe(before);
    expect((await values(source)).name).toBe('');
  });

  it('fills a single field', async () => {
    const { source, id } = await openCleared();
    const rows = planFill(await reloadStops(), INFO, { locale: 'en' });
    const row = rows.find((r) => r.stop.name === 'name');
    if (!row) throw new Error('no row');
    const plan = createFillPlan([row], { onlyTicked: false });
    if (!plan) throw new Error('no plan');
    expect(plan.items).toHaveLength(1);
    expect(await fillActiveFormFromMyInfo(plan)).toEqual({ status: 'filled', filled: 1 });
    await whenIdle();
    expect(labels().at(-1)).toBe('Fill from My info');
    expect((await values(source)).name).toBe('Ayşe Yılmaz');
    expect(doc().fields?.find((f) => f.id === id)?.value ?? '').toBe('');
  });

  it('refuses a stale plan: an engine field or a created field changed since', async () => {
    const { source, id } = await openCleared();
    const plan = await planOf();
    if (!plan) throw new Error('no plan');
    expect(
      await commitFieldValue({ source, name: 'name', widget: 0, pageId: 'x' as PageId }, 'Bob'),
    ).toBe(true);
    const before = labels().length;
    expect(await fillActiveFormFromMyInfo(plan)).toEqual({ status: 'stale', filled: 0 });
    expect(labels().length).toBe(before);
    expect((await values(source)).name).toBe('Bob');
    // Nothing was written to the created field either.
    expect(doc().fields?.find((f) => f.id === id)?.value ?? '').toBe('');

    // Created field typed meanwhile: the engine field stays untouched too.
    await commitFieldValue({ source, name: 'name', widget: 0, pageId: 'x' as PageId }, '');
    const again = await planOf();
    if (!again) throw new Error('no plan');
    await commitFieldValue(
      { fieldId: id, name: 'Email', widget: 0, pageId: 'x' as PageId },
      'a@b.c',
    );
    expect((await fillActiveFormFromMyInfo(again)).status).toBe('stale');
    expect((await values(source)).name).toBe('');
  });

  it('refuses a plan for another document', async () => {
    await openCleared();
    const plan = await planOf();
    if (!plan) throw new Error('no plan');
    await model().openFiles([await fixtureFile(formsAUrl, 'again.pdf')]);
    expect((await fillActiveFormFromMyInfo(plan)).status).toBe('stale');
  });

  it('re-renders the pages of the fields it filled, on other pages too', async () => {
    const pdf = await PDFDocument.create();
    const form = pdf.getForm();
    const p1 = pdf.addPage([300, 300]);
    const p2 = pdf.addPage([300, 300]);
    form.createTextField('Email').addToPage(p1, { x: 20, y: 200, width: 200, height: 20 });
    form.createTextField('Surname').addToPage(p2, { x: 20, y: 200, width: 200, height: 20 });
    await model().openFiles([
      new File([(await pdf.save()).slice()], 'two.pdf', { type: 'application/pdf' }),
    ]);
    enterEditMode();
    const plan = await planOf();
    expect(plan?.items.map((i) => i.name).sort()).toEqual(['Email', 'Surname']);
    if (!plan) throw new Error('no plan');
    const spy = vi.spyOn(getEngineService(), 'invalidatePage');
    expect((await fillActiveFormFromMyInfo(plan)).status).toBe('filled');
    await whenIdle();
    await reloadStops();
    const pages = spy.mock.calls.map(([, index]) => index);
    expect(pages).toContain(0);
    expect(pages).toContain(1);
  });

  it('remembers which fields came from My info and which by hand', async () => {
    const { source, documentId } = await openCleared();
    const plan = await planOf();
    if (!plan) throw new Error('no plan');
    await commitFieldValue(
      { source, name: 'address.city', widget: 0, pageId: 'x' as PageId },
      'Ankara',
    );
    const without = { ...plan, items: plan.items.filter((i) => i.name === 'name') };
    await fillActiveFormFromMyInfo(without);
    expect(originOf(documentId, { source, name: 'name' })).toBe('my-info');
    expect(originOf(documentId, { source, name: 'address.city' })).toBe('manual');
    expect(originOf(documentId, { source, name: 'other' })).toBeUndefined();
  });

  it('applying the same plan twice fills once; the second is stale', async () => {
    const { source } = await openCleared();
    const plan = await planOf();
    if (!plan) throw new Error('no plan');
    expect((await fillActiveFormFromMyInfo(plan)).status).toBe('filled');
    await whenIdle();
    const count = labels().length;
    expect(await fillActiveFormFromMyInfo(plan)).toEqual({ status: 'stale', filled: 0 });
    expect(labels().length).toBe(count);
    expect((await values(source)).name).toBe('Ayşe Yılmaz');
  });

  describe('nothing half-filled', () => {
    const createdValue = (id: unknown) => doc().fields?.find((f) => f.id === id)?.value ?? '';

    it('an engine error: failed, created fields untouched', async () => {
      const { source, id } = await openCleared();
      const plan = await planOf();
      if (!plan) throw new Error('no plan');
      const { editor } = await engineContext();
      const count = labels().length;
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const spy = vi.spyOn(editor, 'listFormFields').mockRejectedValueOnce(new Error('boom'));
      expect(await fillActiveFormFromMyInfo(plan)).toEqual({ status: 'failed', filled: 0 });
      spy.mockRestore();
      expect(labels().length).toBe(count);
      expect(createdValue(id)).toBe('');
      expect((await values(source)).name).toBe('');
    });

    it('the history moving mid-fill: failed, created fields untouched', async () => {
      const { source, id } = await openCleared();
      const plan = await planOf();
      if (!plan) throw new Error('no plan');
      const { editor } = await engineContext();
      const real = editor.listFormFields.bind(editor);
      vi.spyOn(editor, 'listFormFields').mockImplementationOnce(async (src) => {
        const fields = await real(src);
        model().undo();
        return fields;
      });
      expect((await fillActiveFormFromMyInfo(plan)).status).toBe('failed');
      expect(createdValue(id)).toBe('');
      expect((await values(source)).name).toBe('');
    });

    it('a created field changing during the engine step: stale, nothing written', async () => {
      const { source, id } = await openCleared();
      const plan = await planOf();
      if (!plan) throw new Error('no plan');
      const { editor } = await engineContext();
      const real = editor.listFormFields.bind(editor);
      vi.spyOn(editor, 'listFormFields').mockImplementationOnce(async (src) => {
        const fields = await real(src);
        await commitFieldValue(
          { fieldId: id, name: 'Email', widget: 0, pageId: 'x' as PageId },
          'x@y.z',
        );
        return fields;
      });
      expect((await fillActiveFormFromMyInfo(plan)).status).toBe('stale');
      expect((await values(source)).name).toBe('');
      expect(createdValue(id)).toBe('x@y.z');
    });
  });

  describe('a created write that goes wrong after the engine commit', () => {
    for (const [name, result, status] of [
      ['reports stale', { done: [], stale: true, failed: false }, 'stale'],
      ['fails to commit', { done: [], stale: false, failed: true }, 'failed'],
    ] as const) {
      it(`${name}: the fill is undone, redo is gone, other entries stay`, async () => {
        const { source, id } = await openCleared();
        const plan = await planOf();
        if (!plan) throw new Error('no plan');
        await whenIdle();
        const count = labels().length;
        vi.mocked(fillCreatedFields).mockReturnValueOnce(result);
        expect(await fillActiveFormFromMyInfo(plan)).toEqual({ status, filled: 0 });
        await whenIdle();
        expect(labels().length).toBe(count);
        expect(labels().at(-1)).not.toBe('Fill from My info');
        expect(model().redo()).toBeUndefined();
        expect((await values(source)).name).toBe('');
        expect(doc().fields?.find((f) => f.id === id)?.value ?? '').toBe('');
      });
    }

    it('does not undo an entry that is not this fill', async () => {
      const { source } = await openCleared();
      const plan = await planOf();
      if (!plan) throw new Error('no plan');
      await whenIdle();
      vi.mocked(fillCreatedFields).mockImplementationOnce(() => {
        // Someone pushed another entry after the engine commit.
        updateField(plan.items.find((i) => i.fieldId)?.fieldId as never, { required: true });
        return { done: [], stale: true, failed: false };
      });
      const count = labels().length;
      expect((await fillActiveFormFromMyInfo(plan)).status).toBe('stale');
      expect(labels().length).toBe(count + 2);
      expect((await values(source)).name).toBe('Ayşe Yılmaz');
    });
  });

  it('a plan is refused when My info is locked, forgotten or changed since', async () => {
    const { source } = await openCleared();
    const plan = await planOf();
    if (!plan) throw new Error('no plan');
    useMyInfo.setState({ status: 'locked' });
    expect(await fillActiveFormFromMyInfo(plan)).toEqual({ status: 'locked', filled: 0 });
    useMyInfo.setState({ status: 'loading' });
    await forgetMyInfo();
    expect(await fillActiveFormFromMyInfo(plan)).toEqual({ status: 'stale', filled: 0 });
    // lockNow-style: the profile object was replaced.
    const again = await planOf();
    if (!again) throw new Error('no plan');
    useMyInfo.setState({ profile: { fields: {}, keepNationalId: false } });
    expect((await fillActiveFormFromMyInfo(again)).status).toBe('stale');
    expect((await values(source)).name).toBe('');
  });
});
