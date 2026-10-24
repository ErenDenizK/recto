/**
 * When the editing chunk loads (EDN-21): never by itself, at ✎ pointerdown, and when the open
 * document has form fields.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEngineService } from '../../engine/engine-service';
import { prepareEditing, useLoadMarkForForms } from './mark-host';

const chunk = vi.hoisted(() => ({ loads: 0 }));
const engine = vi.hoisted(() => ({ fields: [] as unknown[] }));

vi.mock('./mark', () => {
  chunk.loads += 1;
  return {};
});

const doc = {
  pages: [{ ref: { kind: 'source', source: 'src-1' } }],
} as unknown as VirtualDocument;

function Probe({ useIt }: { readonly useIt: (d: VirtualDocument) => void }) {
  useIt(doc);
  return null;
}

describe('the editing chunk loads on intent', () => {
  beforeEach(() => {
    vi.spyOn(getEngineService(), 'editor').mockResolvedValue({
      listFormFields: () => Promise.resolve(engine.fields),
    } as never);
  });

  it('does not load by itself, for a document without form fields', async () => {
    render(<Probe useIt={useLoadMarkForForms} />);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(chunk.loads).toBe(0);
  });

  it('loads at ✎ pointerdown', async () => {
    prepareEditing();
    await waitFor(() => expect(chunk.loads).toBe(1));
  });
});
