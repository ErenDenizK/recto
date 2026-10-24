/**
 * The editing chunk loads when a page with form fields comes near the view, not before (EDN-21).
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEngineService } from '../../engine/engine-service';
import { useLoadMarkForForms } from './mark-host';

const chunk = vi.hoisted(() => ({ loads: 0 }));
const engine = vi.hoisted(() => ({ fields: [{ name: 'a', pageIndex: 1 }] as unknown[] }));

vi.mock('./mark', () => {
  chunk.loads += 1;
  return {};
});

const doc = {
  pages: [0, 1].map((index) => ({ ref: { kind: 'source', source: 'src-1', index } })),
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

  it('waits for the field page to mount, then loads once', async () => {
    const stage = document.body.appendChild(document.createElement('div'));
    stage.innerHTML = '<div data-page-index="0"></div>';
    render(<Probe useIt={useLoadMarkForForms} />);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(chunk.loads).toBe(0);
    stage.insertAdjacentHTML('beforeend', '<div data-page-index="1"></div>');
    await waitFor(() => expect(chunk.loads).toBe(1));
    stage.remove();
  });
});
