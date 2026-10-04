/**
 * Notes in the compact reader (ADR-0033 §2.3: "a note shows its text on tap"). The page
 * bitmap already draws every annotation, form field and signature as the file shows them
 * (the engine renders with annotations and forms on); none of them takes input here. Only
 * note annotations (/Text, the sticky notes) get a target: a tap opens a small popover with
 * the note's text, author and date.
 *
 * Notes are read through the engine's read-only `listAnnotations` for pages near the view,
 * cached per source page like the link hotspots. A note's target is at least 44 px square,
 * centred on its icon, so a finger finds it (quality bar Q-9).
 */
import { Popover } from '@base-ui/react/popover';
import type { SourceId } from '@pdf-editor/document-model';
import type { Annotation, NoteAnnotation } from '@pdf-editor/engine';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getEngineService } from '../../engine/engine-service';
import { getLocale, m } from '../../i18n';
import type { PageOverlayProps } from '../../stage/page-overlays';
import { distanceFromView, useViewStore } from '../../state/view-store';
import { userRectToCss } from '../../viewer/geometry';
import { pageFrame } from '../../viewer/page-frame';
import controls from './controls.module.css';
import styles from './NoteLayer.module.css';

const MAX_CACHED_PAGES = 300;
/** A note's target is at least this big, CSS px. */
const MIN_TARGET = 44;
const notes = new Map<string, Promise<readonly NoteAnnotation[]>>();

function isNote(annotation: Annotation): annotation is NoteAnnotation {
  return annotation.kind === 'text' && annotation.flags?.hidden !== true;
}

/** The note annotations of a source page (memoized; failures are not kept). */
export function pageNotes(sourceId: SourceId, index: number): Promise<readonly NoteAnnotation[]> {
  const key = `${sourceId}:${index}`;
  const cached = notes.get(key);
  if (cached) return cached;
  const pending = getEngineService()
    .editor()
    .then((editor) => editor.listAnnotations(sourceId, index))
    .then((annotations) => annotations.filter(isNote));
  pending.catch(() => notes.delete(key));
  notes.set(key, pending);
  if (notes.size > MAX_CACHED_PAGES) {
    const oldest = notes.keys().next().value;
    if (oldest !== undefined) notes.delete(oldest);
  }
  return pending;
}

/** A PDF date (`D:20261004120000+03'00'`) or ISO string as a short local date, if readable. */
export function noteDate(value: string | undefined, locale: string): string | undefined {
  if (!value) return undefined;
  const pdf = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(value);
  const date = pdf
    ? new Date(
        Number(pdf[1]),
        Number(pdf[2] ?? 1) - 1,
        Number(pdf[3] ?? 1),
        Number(pdf[4] ?? 0),
        Number(pdf[5] ?? 0),
      )
    : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

export function NoteLayer(props: PageOverlayProps) {
  const { sourceId, sourceIndex, pageIndex } = props;
  const near = useViewStore((s) => distanceFromView(pageIndex, s.visibleRange) <= 1);
  const key = `${sourceId ?? ''}:${sourceIndex}`;
  const [found, setFound] = useState<{
    key: string;
    notes: readonly NoteAnnotation[];
  } | null>(null);

  useEffect(() => {
    if (!near || sourceId === undefined) return;
    let cancelled = false;
    pageNotes(sourceId, sourceIndex).then(
      (list) => {
        if (!cancelled) setFound({ key, notes: list });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [near, sourceId, sourceIndex, key]);

  if (found?.key !== key || found.notes.length === 0) return null;
  const frame = pageFrame(props);
  return (
    <div className={styles.layer} data-testid="note-layer">
      {found.notes.map((note) => {
        const box = userRectToCss(frame, note.rect);
        const width = Math.max(MIN_TARGET, box.width);
        const height = Math.max(MIN_TARGET, box.height);
        return (
          <NoteTarget
            key={note.id}
            note={note}
            style={{
              left: box.left + box.width / 2 - width / 2,
              top: box.top + box.height / 2 - height / 2,
              width,
              height,
            }}
          />
        );
      })}
    </div>
  );
}

function NoteTarget({
  note,
  style,
}: {
  readonly note: NoteAnnotation;
  readonly style: { left: number; top: number; width: number; height: number };
}) {
  const text = note.contents?.trim() ?? '';
  const date = noteDate(note.modified, getLocale());
  const byline = [note.author?.trim(), date].filter(Boolean).join(' · ');
  return (
    <Popover.Root>
      <Popover.Trigger
        className={styles.target}
        style={style}
        aria-label={
          note.author ? `${m.compact_note_show()}: ${note.author}` : m.compact_note_show()
        }
        data-compact-interactive=""
      />
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="center" sideOffset={4} collisionPadding={12}>
          <Popover.Popup className={styles.popup} data-testid="note-popover">
            <div className={styles.header}>
              <div className={styles.heading}>
                <Popover.Title className={styles.title}>{m.compact_note()}</Popover.Title>
                {byline ? <p className={styles.byline}>{byline}</p> : null}
              </div>
              <Popover.Close className={controls.icon} aria-label={m.common_close()}>
                <X aria-hidden="true" />
              </Popover.Close>
            </div>
            <Popover.Description className={styles.text} data-empty={text === '' || undefined}>
              {text === '' ? m.compact_note_empty() : text}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
