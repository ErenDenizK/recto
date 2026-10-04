/**
 * Retention (ADR-0032 §2.7, owner answer 2): 30 days or 500 MB, oldest first; open documents
 * never expire; shared files are counted once and deleted only when nothing needs them.
 */
import { describe, expect, it } from 'vitest';

import { planRetention, RETENTION_MAX_AGE_MS, RETENTION_MAX_BYTES } from './retention';
import type { StoredFileInfo } from './storage';

const MB = 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

function stored(
  entries: Record<string, number>,
  lastModified = NOW - DAY,
): Map<string, StoredFileInfo> {
  return new Map(
    Object.entries(entries).map(([key, size]) => [
      key,
      { name: key.split('/')[1] ?? key, size, lastModified },
    ]),
  );
}

describe('planRetention', () => {
  it('expires closed documents kept for more than 30 days', () => {
    const plan = planRetention({
      now: NOW,
      live: new Set(),
      stored: stored({
        'kept/a.json': 1,
        'kept/b.json': 1,
        'sources/a.pdf': 10,
        'sources/b.pdf': 10,
      }),
      kept: [
        {
          id: 'a',
          keptAt: NOW - RETENTION_MAX_AGE_MS - 1,
          files: ['kept/a.json', 'sources/a.pdf'],
        },
        {
          id: 'b',
          keptAt: NOW - RETENTION_MAX_AGE_MS + DAY,
          files: ['kept/b.json', 'sources/b.pdf'],
        },
      ],
    });
    expect(plan.expired).toEqual(['a']);
    expect([...plan.unreferenced].sort()).toEqual(['kept/a.json', 'sources/a.pdf']);
    expect(plan.bytes).toBe(11);
  });

  it('drops the oldest first until everything fits in 500 MB', () => {
    const plan = planRetention({
      now: NOW,
      live: new Set(['sessions/t.json', 'sources/open.pdf']),
      stored: stored({
        'sessions/t.json': 1,
        'sources/open.pdf': 100 * MB,
        'sources/old.pdf': 200 * MB,
        'sources/mid.pdf': 150 * MB,
        'sources/new.pdf': 100 * MB,
        'kept/old.json': 1,
        'kept/mid.json': 1,
        'kept/new.json': 1,
      }),
      kept: [
        { id: 'new', keptAt: NOW - 1 * DAY, files: ['kept/new.json', 'sources/new.pdf'] },
        { id: 'old', keptAt: NOW - 3 * DAY, files: ['kept/old.json', 'sources/old.pdf'] },
        { id: 'mid', keptAt: NOW - 2 * DAY, files: ['kept/mid.json', 'sources/mid.pdf'] },
      ],
    });
    // 550 MB + records: the oldest (200 MB) goes, and 350 MB remains.
    expect(plan.expired).toEqual(['old']);
    expect(plan.bytes).toBeLessThanOrEqual(RETENTION_MAX_BYTES);
    expect([...plan.unreferenced].sort()).toEqual(['kept/old.json', 'sources/old.pdf']);
  });

  it('never expires open documents, even past 500 MB', () => {
    const plan = planRetention({
      now: NOW,
      live: new Set(['sessions/t.json', 'sources/huge.pdf']),
      stored: stored({ 'sessions/t.json': 1, 'sources/huge.pdf': 600 * MB, 'kept/k.json': 1 }),
      kept: [{ id: 'k', keptAt: NOW, files: ['kept/k.json'] }],
    });
    expect(plan.expired).toEqual(['k']);
    expect(plan.unreferenced).toEqual(['kept/k.json']);
  });

  it('keeps a file another snapshot still needs, and counts it once', () => {
    const plan = planRetention({
      now: NOW,
      live: new Set(['sessions/t.json', 'sources/shared.pdf']),
      stored: stored({ 'sessions/t.json': 1, 'sources/shared.pdf': 300 * MB, 'kept/a.json': 1 }),
      kept: [
        {
          id: 'a',
          keptAt: NOW - RETENTION_MAX_AGE_MS - 1,
          files: ['kept/a.json', 'sources/shared.pdf'],
        },
      ],
    });
    expect(plan.expired).toEqual(['a']);
    expect(plan.unreferenced).toEqual(['kept/a.json']);
    expect(plan.bytes).toBe(300 * MB + 1);
  });

  it('leaves young orphan files alone (another tab may be writing its manifest)', () => {
    const files = stored({ 'sources/young.pdf': 5 }, NOW - 1000);
    for (const [key, info] of stored({ 'sources/old.pdf': 5 }, NOW - 10 * 60_000))
      files.set(key, info);
    const plan = planRetention({ now: NOW, live: new Set(), stored: files, kept: [] });
    expect(plan.unreferenced).toEqual(['sources/old.pdf']);
  });
});
