/**
 * The questions a save asks, anchored below Save (01-frame F7 §2, §5, §6; ADR-0032 §2.1; spec
 * 07.10), on the popover primitive (M4, 320 px):
 *
 * - **Replace** — "Replace report.pdf? · Recto writes your changes into the file you opened.
 *   You can still revert to the opened version on this device. · Save a copy… · Replace ·
 *   ☐ Don't ask again for this file". Asked once per file per session, before the first write
 *   over it; focus starts on Replace.
 * - **Unapplied marks** — "2 marks not applied · The text under 2 marks is still in the file. ·
 *   Save without applying · Apply and save", asked before Replace; Apply and save is the
 *   default and takes focus.
 *
 * Esc or a press outside answers neither (the save stops). Focus returns to Save.
 */
import { Popover } from '@base-ui/react/popover';
import { useRef, useState } from 'react';

import { answerSaveQuestion, type SaveQuestion, useSaveStore } from '../../files/save';
import { m } from '../../i18n';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import popoverStyles from '../../ui/Popover.module.css';
import styles from './ReplacePopover.module.css';
import { SAVE_BUTTON_ID } from './SaveButton';

// Below Save; on a compact window, where Save lives in the title menu, below the title.
const saveButton = () =>
  document.getElementById(SAVE_BUTTON_ID) ?? document.getElementById('compact-title');

export function ReplacePopover() {
  const pending = useSaveStore((s) => s.pending);
  const question = pending?.question ?? null;
  return (
    <Popover.Root
      open={question !== null}
      onOpenChange={(open) => {
        if (!open) answerSaveQuestion('cancel');
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={saveButton}
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={8}
        >
          {question ? <Question key={questionKey(question)} question={question} /> : null}
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function questionKey(question: SaveQuestion): string {
  return `${question.kind}:${question.documentId}`;
}

function Question({ question }: { readonly question: SaveQuestion }) {
  const primary = useRef<HTMLButtonElement>(null);
  const [dontAsk, setDontAsk] = useState(false);
  const finalFocus = { current: saveButton() };
  if (question.kind === 'marks') {
    const { count } = question;
    return (
      <Popover.Popup
        className={`${popoverStyles.popup} ${styles.popup}`}
        initialFocus={primary}
        finalFocus={finalFocus}
        data-testid="save-marks-popover"
      >
        <Popover.Title className={popoverStyles.title}>
          {m.save_marks_title({ count })}
        </Popover.Title>
        <Popover.Description className={popoverStyles.body}>
          {m.save_marks_body({ count })}
        </Popover.Description>
        <div className={styles.actions}>
          <Button variant="standard" onClick={() => answerSaveQuestion('without')}>
            {m.save_marks_without()}
          </Button>
          <Button ref={primary} variant="prominent" onClick={() => answerSaveQuestion('apply')}>
            {m.save_marks_apply()}
          </Button>
        </div>
      </Popover.Popup>
    );
  }
  return (
    <Popover.Popup
      className={`${popoverStyles.popup} ${styles.popup}`}
      initialFocus={primary}
      finalFocus={finalFocus}
      data-testid="replace-popover"
    >
      <Popover.Title className={popoverStyles.title}>
        {m.save_replace_title({ name: question.name })}
      </Popover.Title>
      <Popover.Description className={popoverStyles.body}>
        {m.save_replace_body()}
      </Popover.Description>
      <Checkbox
        className={styles.dontAsk}
        checked={dontAsk}
        onCheckedChange={setDontAsk}
        label={m.save_replace_dont_ask()}
      />
      <div className={styles.actions}>
        <Button variant="standard" onClick={() => answerSaveQuestion('copy')}>
          {m.save_a_copy()}
        </Button>
        <Button
          ref={primary}
          variant="prominent"
          onClick={() => answerSaveQuestion('replace', { dontAsk })}
        >
          {m.save_replace()}
        </Button>
      </div>
    </Popover.Popup>
  );
}
