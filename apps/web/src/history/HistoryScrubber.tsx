/**
 * The History scrubber (08-feedback FB7; flows.md §5.3; ADR-0032 §2.8): go back further than
 * one step and see what each step was. Opens under ↶ (long press, right-click, Shift+F10,
 * the Menu key, ⌘K "Show history…"); replaces the inspector's History list once D2 removes
 * the inspector.
 *
 * - **Fine pointers:** the list (`HistoryList`), 360 px wide and at most 400 px tall.
 * - **Coarse pointers:** the slider (`HistorySlider`), 360 × 120.
 * - **Preview and keep** (FB7 §6): moving previews the step on the page (`preview.ts`); a
 *   click, Enter or a slider release keeps it, announces "Now at step 12 of 20: …" and
 *   reveals the change; Esc, a press outside or Cancel restore the step it opened at. Focus
 *   goes back to ↶ either way.
 * - History jumps bypass `commit()`, so the scrubber works in Read mode and, from D1, while a
 *   document is locked (flows.md §2.5 rule 4).
 *
 * Material: the shared popover recipe (`ui/Popover.module.css`, M4 in the coverage registry),
 * whose rise-in is its motion; previews move the page without animation.
 */
import { Popover } from '@base-ui/react/popover';
import { DEFAULT_HISTORY_TAIL } from '@pdf-editor/document-model';
import { type RefObject, useRef, useState } from 'react';

import { m } from '../i18n';
import { useSessionStore } from '../session/session-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { EmptyNote } from '../ui/EmptyNote';
import popoverStyles from '../ui/Popover.module.css';
import { useCoarsePointer } from '../ui/Slider';
import { HistoryList } from './HistoryList';
import styles from './HistoryScrubber.module.css';
import { HistorySlider } from './HistorySlider';
import { scrubberSteps } from './labels';
import {
  closeHistoryScrubber,
  isOpenOpening,
  type ScrubberOpening,
  useHistoryScrubber,
} from './scrubber-store';

export interface HistoryScrubberProps {
  /** ↶, which the popover sits under and gives focus back to. */
  readonly anchor: RefObject<HTMLElement | null>;
}

export function HistoryScrubber({ anchor }: HistoryScrubberProps) {
  const open = useHistoryScrubber((s) => s.opening !== null);
  const last = useHistoryScrubber((s) => s.last);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        // Esc or a press outside: the step it opened at comes back.
        if (!next) closeHistoryScrubber();
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={8}
        >
          {last ? <ScrubberPopup key={last.serial} anchor={anchor} opening={last} /> : null}
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ScrubberPopup({
  anchor,
  opening,
}: HistoryScrubberProps & { readonly opening: ScrubberOpening }) {
  // A popup playing its exit no longer acts.
  const onKeep = (index: number) => {
    if (isOpenOpening(opening)) closeHistoryScrubber(index);
  };
  const onCancel = () => {
    if (isOpenOpening(opening)) closeHistoryScrubber();
  };
  const history = useWorkspaceStore((s) => s.history);
  const keeping = useSessionStore((s) => s.keeping === 'available');
  const coarse = useCoarsePointer();
  const listRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(opening.start);

  const steps = scrubberSteps(history);
  const present = history.past.length;
  const documents = history.present.workspace.documentOrder.length;
  const activeStep = steps.find((s) => s.index === active);
  // "Previewing step 12" while the page shows another step than the one it opened at.
  const shown = steps.findIndex((s) => s.index === present);
  const previewing = present !== opening.start && shown >= 0 ? steps.length - shown : undefined;

  const moveTo = (index: number) => {
    if (!isOpenOpening(opening)) return;
    setActive(index);
    opening.preview.preview(index);
  };

  let title: string = m.history_title();
  if (coarse && activeStep) title = activeStep.label;
  else if (previewing !== undefined) title = m.history_previewing({ index: previewing });

  return (
    <Popover.Popup
      className={`${popoverStyles.popup} ${styles.popup}`}
      data-testid="history-scrubber"
      data-presentation={coarse ? 'slider' : 'list'}
      initialFocus={coarse ? sliderRef : listRef}
      finalFocus={anchor}
    >
      <div className={styles.head}>
        <Popover.Title className={`${popoverStyles.title} ${styles.title}`}>{title}</Popover.Title>
        {coarse ? (
          <span className={styles.aside}>{activeStep?.time}</span>
        ) : documents > 1 ? (
          <span className={styles.aside}>{m.history_documents({ count: documents })}</span>
        ) : null}
      </div>
      {steps.length < 2 ? (
        <div className={styles.empty}>
          <EmptyNote title={m.history_empty()} />
        </div>
      ) : coarse ? (
        <HistorySlider
          steps={[...steps].reverse()}
          active={active}
          onActiveChange={moveTo}
          onKeep={onKeep}
          onCancel={onCancel}
          inputRef={sliderRef}
        />
      ) : (
        <HistoryList
          steps={steps}
          active={active}
          tailFrom={keeping && history.past.length > DEFAULT_HISTORY_TAIL ? present : undefined}
          onActiveChange={moveTo}
          onKeep={onKeep}
          listRef={listRef}
        />
      )}
    </Popover.Popup>
  );
}
