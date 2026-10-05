/**
 * S6, the password prompt on open (components/07-sheets.md §8; ARCHITECTURE.md §5), on the
 * Sheet primitive: answers the engine service's requests (`state/password-store.ts`) one at a
 * time, as a `confirmation` sheet, a centred 400 px `alertdialog` (a compact modal sheet on
 * narrow windows) over the scrim.
 *
 * - "Password required", "report.pdf is protected. The password is used on this device only.",
 *   the field with Show, and "1 of 3" under the title while several files wait (§8.2).
 * - Enter or Open tries the password. The sheet stays while PDFium tries it, Open busy after
 *   400 ms (§8.4), and the engine's answer decides: a wrong password comes back as a retry
 *   for the same file, shown in place with the error under the field, the field cleared and
 *   focused, and said assertively (§8.4, §8.8); otherwise the file has opened and the sheet
 *   leaves (or the next file waiting takes its place). The engine reports no success, so the
 *   sheet reads it from the workspace's count of files opening, with a 4 s ceiling.
 * - Skip file, or Esc, leaves the file closed (the caller announces it; the toast with Try
 *   again of §8.5 comes with the toast system, D0-5).
 * - The password is never a draft: it lives in the form for one try and is gone with it.
 */
import { Eye, EyeOff } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { m } from '../i18n';
import { answerPassword, type PasswordRequest, usePasswordStore } from '../state/password-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { IconButton } from '../ui/IconButton';
import { Sheet, SheetField } from '../ui/sheet';
import { announce } from './announcer';
import styles from './PasswordDialog.module.css';

/** How long a tried password may hold the sheet open without an answer from the engine. */
const TRY_CEILING_MS = 4000;

/** A password handed to the engine, waiting for its answer. */
interface Trying {
  readonly request: PasswordRequest;
  /** The workspace's files-opening count when it was handed over. */
  readonly opening: number;
}

export function PasswordDialog() {
  const queue = usePasswordStore((s) => s.queue);
  const opening = useWorkspaceStore((s) => s.opening);
  const request = queue[0];
  const [trying, setTrying] = useState<Trying | null>(null);
  // Files answered in this run of prompts, for "2 of 3".
  const [done, setDone] = useState(0);
  // The last request shown, kept while the sheet animates closed.
  const [last, setLast] = useState<PasswordRequest | null>(null);
  if (request && request !== last) setLast(request);

  // The engine answered: a retry (or the next file) arrived, or the file finished opening.
  if (trying && (request !== undefined || opening < trying.opening)) {
    setTrying(null);
    const retry = request?.incorrect === true && request.fileName === trying.request.fileName;
    if (!retry) setDone(done + 1);
  }
  if (!request && !trying && done !== 0) setDone(0);

  useEffect(() => {
    if (!trying) return undefined;
    const timer = window.setTimeout(() => setTrying(null), TRY_CEILING_MS);
    return () => window.clearTimeout(timer);
  }, [trying]);

  const shown = request ?? trying?.request ?? last;
  const open = request !== undefined || trying !== null;
  const total = done + queue.length + (trying && !request ? 1 : 0);

  return shown ? (
    <PasswordSheet
      request={shown}
      open={open}
      busy={trying !== null && request === undefined}
      queue={total > 1 ? m.password_queue({ index: done + 1, count: total }) : undefined}
      onTry={(password) => {
        setTrying({ request: shown, opening: useWorkspaceStore.getState().opening });
        answerPassword(shown.id, password);
      }}
      onSkip={() => {
        if (!request) return;
        setDone(done + 1);
        answerPassword(request.id, null);
      }}
    />
  ) : null;
}

function PasswordSheet({
  request,
  open,
  busy,
  queue,
  onTry,
  onSkip,
}: {
  readonly request: PasswordRequest;
  readonly open: boolean;
  readonly busy: boolean;
  readonly queue: string | undefined;
  readonly onTry: (password: string) => void;
  readonly onSkip: () => void;
}) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // One sheet for the whole queue, so a retry or the next file changes in place: each request
  // starts with an empty field.
  const [seen, setSeen] = useState(request.id);
  if (seen !== request.id) {
    setSeen(request.id);
    setValue('');
  }

  // A retry after a wrong password: the field is new (cleared), focused, and the error said.
  useEffect(() => {
    if (!request.incorrect) return;
    inputRef.current?.focus();
    announce(m.password_incorrect(), { politeness: 'assertive' });
  }, [request]);

  return (
    <Sheet
      id="password-prompt"
      kind="confirmation"
      open={open}
      onClose={onSkip}
      title={m.password_title()}
      subtitle={queue}
      description={<PasswordDescription fileName={request.fileName} />}
      primary={{ label: m.password_open(), onPress: () => onTry(value), busy }}
      cancel={m.password_skip()}
      initialFocus={inputRef}
      testId="password-dialog"
    >
      <SheetField
        ref={inputRef}
        type={show ? 'text' : 'password'}
        label={m.password_label()}
        autoComplete="current-password"
        spellCheck={false}
        value={value}
        error={request.incorrect ? m.password_incorrect() : null}
        readOnly={busy}
        onChange={(event) => setValue(event.target.value)}
        trailing={
          <IconButton
            size="row"
            label={m.password_show()}
            aria-pressed={show}
            icon={show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            onClick={() => setShow(!show)}
          />
        }
      />
    </Sheet>
  );
}

/**
 * The description with the file name emphasised. The message is split at the name's
 * placeholder so word order follows the language.
 */
function PasswordDescription({ fileName }: { readonly fileName: string }): ReactNode {
  const marker = '\u0000';
  const [before = '', after = ''] = m.password_description({ name: marker }).split(marker);
  return (
    <>
      {before}
      <span className={styles.fileName}>{fileName}</span>
      {after}
    </>
  );
}
