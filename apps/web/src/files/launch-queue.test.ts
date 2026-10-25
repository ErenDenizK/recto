import { afterEach, describe, expect, it, vi } from 'vitest';

import { fileHandleOf } from './open-files';
import { filesFromLaunch, installLaunchConsumer } from './launch-queue';

const handle = (name: string, type: string) => {
  const file = new File(['x'], name, { type });
  return { kind: 'file' as const, name, getFile: () => Promise.resolve(file) };
};

describe('launch queue (PRD-31)', () => {
  afterEach(() => {
    delete (window as { launchQueue?: unknown }).launchQueue;
  });

  it('keeps openable files with their handles and drops the rest', async () => {
    const pdf = handle('a.pdf', 'application/pdf');
    const files = await filesFromLaunch({
      files: [pdf, handle('b.zip', 'application/zip'), handle('n.md', '')],
    });
    expect(files.map((f) => f.name)).toEqual(['a.pdf', 'n.md']);
    expect(fileHandleOf(files[0] as File)).toBe(pdf);
  });

  it('does nothing without launchQueue', () => {
    expect(installLaunchConsumer(vi.fn())).toBe(false);
  });

  it('passes a launch to open', async () => {
    let consumer: (p: { files: unknown[] }) => void = () => undefined;
    (window as { launchQueue?: unknown }).launchQueue = {
      setConsumer: (fn: typeof consumer) => (consumer = fn),
    };
    const open = vi.fn();
    expect(installLaunchConsumer(open)).toBe(true);
    consumer({ files: [handle('a.pdf', 'application/pdf')] });
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
  });
});
