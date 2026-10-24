/**
 * The editing chunk loads when the open document has form fields (EDN-21).
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEngineService } from '../../engine/engine-service';
import { useLoadMarkForForms } from './mark-host';

const chunk = vi.hoisted(() => ({ loads: 0 }));
const engine = vi.hoisted(() => ({ fields: [{ name: 'a' }] as unknown[] }));

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

describe('the editing chunk loads for form fields', () => {
  beforeEach(() => {
    vi.spyOn(getEngineService(), 'editor').mockResolvedValue({
      listFormFields: () => Promise.resolve(engine.fields),
    } as never);
  });

  it('loads when the document has form fields', async () => {
    render(<Probe useIt={useLoadMarkForForms} />);
    await waitFor(() => expect(chunk.loads).toBe(1));
  });
});
