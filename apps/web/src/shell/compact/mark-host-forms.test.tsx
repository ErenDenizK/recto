/**
 * The form fields' chunk loads when a page with form fields comes near the view, not before, and
 * without the editing chunk (EDN-21).
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEngineService } from '../../engine/engine-service';
import { useLoadFieldsForForms } from './mark-host';

const chunk = vi.hoisted(() => ({ loads: 0, markLoads: 0 }));
const list = vi.hoisted(() =>
  vi.fn(() => Promise.resolve([{ name: 'a', pageIndex: 1 }] as unknown[])),
);

vi.mock('./mark/fields', () => {
  chunk.loads += 1;
  return {};
});
vi.mock('./mark', () => {
  chunk.markLoads += 1;
  return {};
});

const doc = {
  pages: [0, 1].map((index) => ({ ref: { kind: 'source', source: 'src-1', index } })),
} as unknown as VirtualDocument;

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function Probe({ useIt }: { readonly useIt: (d: VirtualDocument) => void }) {
  useIt(doc);
  return null;
}

describe('the editing chunk loads for form fields', () => {
  beforeEach(() => {
    vi.spyOn(getEngineService(), 'ensureOpen').mockResolvedValue({ ok: true, value: undefined });
    vi.spyOn(getEngineService(), 'editor').mockResolvedValue({ listFormFields: list } as never);
  });

  it('waits for the field page to mount, then loads once', async () => {
    const stage = document.body.appendChild(document.createElement('div'));
    stage.setAttribute('data-read-viewport', '');
    stage.innerHTML = '<div data-page-index="0"></div>';
    render(<Probe useIt={useLoadFieldsForForms} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await frame();
    await frame();
    expect(chunk.loads).toBe(0);
    stage.insertAdjacentHTML('beforeend', '<div data-page-index="1"></div>');
    await waitFor(() => expect(chunk.loads).toBe(1));
    expect(chunk.markLoads).toBe(0);
    stage.remove();
  });
});
