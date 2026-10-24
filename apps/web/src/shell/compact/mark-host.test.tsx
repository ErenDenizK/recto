/**
 * When the editing chunk loads (EDN-21): never by itself, and at ✎ pointerdown.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEngineService } from '../../engine/engine-service';
import { prepareEditing, useLoadMarkForForms } from './mark-host';

const chunk = vi.hoisted(() => ({ loads: 0 }));
const list = vi.hoisted(() => vi.fn(() => Promise.resolve([] as unknown[])));

vi.mock('./mark', () => {
  chunk.loads += 1;
  return {};
});

const doc = {
  pages: [{ ref: { kind: 'source', source: 'src-1' } }],
} as unknown as VirtualDocument;

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function Probe({ useIt }: { readonly useIt: (d: VirtualDocument) => void }) {
  useIt(doc);
  return null;
}

describe('the editing chunk loads on intent', () => {
  beforeEach(() => {
    vi.spyOn(getEngineService(), 'ensureOpen').mockResolvedValue({ ok: true, value: undefined });
    vi.spyOn(getEngineService(), 'editor').mockResolvedValue({ listFormFields: list } as never);
  });

  it('does not load by itself, for a document without form fields', async () => {
    render(<Probe useIt={useLoadMarkForForms} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await frame();
    await frame();
    expect(chunk.loads).toBe(0);
  });

  it('loads at ✎ pointerdown', async () => {
    prepareEditing();
    await waitFor(() => expect(chunk.loads).toBe(1));
  });
});
