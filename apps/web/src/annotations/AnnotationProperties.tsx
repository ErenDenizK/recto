/**
 * The annotation bar's ⋯ (`components/04-context.md` §5, §14 "Annotation ⋯"; spec D2-9): the
 * properties the bar has no room for, in a popover on the one primitive (`ui/Popover`, §15).
 * It replaces the inspector's Properties section (inventory 6.3, INV-13), whose style controls
 * the bar already carries (colour, opacity, width or font size, Comment, Delete):
 *
 * - **Facts:** type, author, modified and page of the one selected annotation (the count when
 *   several are selected), and "Locked" for a PDF-locked one.
 * - **Text:** the comment (or a text box's text), edited in place; a change commits on blur or
 *   Mod+Enter as one undo step, coalesced per annotation. On a locked document it can be read
 *   and copied, not changed (a `targeted` act, refused by the guard).
 *
 * The armed tool's style, which the inspector also showed with nothing selected, is the ink
 * strip's (`10-ink` §2).
 */
import { Popover } from '@base-ui/react/popover';
import type { Annotation } from '@pdf-editor/engine';
import { useState } from 'react';

import { getLocale, m } from '../i18n';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { PopoverHeader, PopoverPopup } from '../ui/Popover';
import { useCanChangeActive } from '../viewer/input-state';
import { updateAnnotations } from './actions';
import type { PageTarget } from './annotation-store';
import { annotationName, capitalize } from './labels';
import styles from './AnnotationProperties.module.css';

const dateFormat = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
        date,
      );
};

/** ⋯ at the end of the annotation bar, and the popover it opens. */
export function AnnotationPropertiesButton({
  target,
  annotations,
  name,
}: {
  readonly target: PageTarget;
  readonly annotations: readonly Annotation[];
  /** The bar's name for the selection ("Pen", "3 annotations"). */
  readonly name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <IconButton
            label={m.annot_more()}
            icon={<Icon name="dots-three" />}
            data-testid="annotation-more"
          />
        }
      />
      <PopoverPopup
        side="bottom"
        align="end"
        className={styles.popover}
        data-annotation-keep=""
        data-testid="annotation-properties"
      >
        <PopoverHeader title={m.annot_bar_label({ name })} />
        <AnnotationProperties target={target} annotations={annotations} />
      </PopoverPopup>
    </Popover.Root>
  );
}

export function AnnotationProperties({
  target,
  annotations,
}: {
  readonly target: PageTarget;
  readonly annotations: readonly Annotation[];
}) {
  // Changing a selected annotation's text is a targeted act: refused only while locked.
  const editable = useCanChangeActive('targeted');
  const first = annotations[0];
  if (!first) return null;
  const single = annotations.length === 1;
  const locked = annotations.every((a) => a.flags?.locked);
  return (
    <div className={styles.properties}>
      <dl className={styles.facts}>
        <dt>{m.annot_kind()}</dt>
        <dd>
          {single
            ? capitalize(annotationName(first))
            : m.annot_count({ count: annotations.length })}
          {locked ? <span className={styles.locked}>{m.annot_locked_short()}</span> : null}
        </dd>
        {single ? (
          <>
            <dt>{m.annot_author()}</dt>
            <dd>{first.author && first.author !== '' ? first.author : m.annot_no_author()}</dd>
            <dt>{m.annot_modified()}</dt>
            <dd className={styles.numeric}>{first.modified ? dateFormat(first.modified) : '—'}</dd>
          </>
        ) : null}
        <dt>{m.annot_page()}</dt>
        <dd className={styles.numeric}>{target.position}</dd>
      </dl>
      {locked ? <p className={styles.note}>{m.annot_locked()}</p> : null}
      {single ? (
        <ContentsField
          key={`${first.id}:${first.contents ?? ''}`}
          initial={first.kind === 'free-text' ? first.text : (first.contents ?? '')}
          label={first.kind === 'free-text' ? m.annot_text() : m.annot_comment_text()}
          disabled={first.flags?.locked === true}
          readOnly={!editable}
          onCommit={(value) =>
            void updateAnnotations(
              target,
              [first.id],
              (a) =>
                a.kind === 'free-text'
                  ? { ...a, text: value, contents: value }
                  : { ...a, contents: value },
              {
                action: first.kind === 'free-text' ? 'text' : 'comment',
                coalesceKey: `text:${first.id}`,
              },
            )
          }
        />
      ) : null}
    </div>
  );
}

function ContentsField({
  initial,
  label,
  disabled,
  readOnly,
  onCommit,
}: {
  readonly initial: string;
  readonly label: string;
  readonly disabled: boolean;
  /** Locked: the text can be read and copied, not changed. */
  readonly readOnly: boolean;
  readonly onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const commit = () => {
    if (!readOnly && value !== initial) onCommit(value);
  };
  return (
    <label className={styles.contents}>
      <span className={styles.label}>{label}</span>
      <textarea
        value={value}
        rows={3}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={m.annot_comment_placeholder()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
      />
    </label>
  );
}
