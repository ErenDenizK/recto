/**
 * Continue returns to a place every time it is pressed (`resumeDocument`, DSN-66; DSN-87): the
 * Continue card, Esc back to the Library, Continue again must settle the page both times, with
 * the desk on or off. (A time window that skipped the second press once did nothing here.)
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const view = vi.hoisted(() => ({ applyResumeZoom: vi.fn(), settleResume: vi.fn() }));
vi.mock('../session/resume-view', () => view);

import type { ResumePoint } from '../session/resume';
import { resumeDocument } from './home-actions';

const id = 'doc-1' as DocumentId;
const point: ResumePoint = { page: 3, total: 10, zoom: 1.5, fit: null, offset: 90, at: 1 };

describe('resumeDocument', () => {
  beforeEach(() => {
    view.applyResumeZoom.mockClear();
    view.settleResume.mockClear();
  });

  it('settles the place on every press: Continue, back, Continue', async () => {
    await resumeDocument(id, point);
    // Back to the Library and Continue again, straight away, for the same page.
    await resumeDocument(id, point);
    expect(view.applyResumeZoom).toHaveBeenCalledTimes(2);
    expect(view.settleResume).toHaveBeenCalledTimes(2);
    expect(view.settleResume).toHaveBeenLastCalledWith(id, point);
  });

  it('sets the zoom before the page view is asked for', async () => {
    await resumeDocument(id, point);
    const [zoomOrder] = view.applyResumeZoom.mock.invocationCallOrder;
    const [settleOrder] = view.settleResume.mock.invocationCallOrder;
    expect(zoomOrder).toBeLessThan(settleOrder ?? 0);
  });
});
