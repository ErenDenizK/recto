/**
 * The password prompt for an encrypted file in the compact edition (the engine service asks
 * through `state/password-store.ts`, as in the full edition's `PasswordDialog`), as a bottom
 * sheet: the field takes focus, a wrong password asks again with a note, and Skip (or
 * closing the sheet) leaves the file closed with one line in the Library.
 */
import { type RefObject, type SyntheticEvent, useRef, useState } from 'react';

import { m } from '../../i18n';
import { answerPassword, type PasswordRequest, usePasswordStore } from '../../state/password-store';
import { CompactSheet } from './CompactSheet';
import controls from './controls.module.css';
import styles from './CompactPassword.module.css';

export function CompactPassword() {
  const request = usePasswordStore((s) => s.queue[0]);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <CompactSheet
      open={request !== undefined}
      onClose={() => {
        if (request) answerPassword(request.id, null);
      }}
      title={m.password_title()}
      testId="compact-password-sheet"
      initialFocus={inputRef}
    >
      {request ? <PasswordForm key={request.id} request={request} inputRef={inputRef} /> : null}
    </CompactSheet>
  );
}

function PasswordForm({
  request,
  inputRef,
}: {
  readonly request: PasswordRequest;
  readonly inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [value, setValue] = useState('');
  const onSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    answerPassword(request.id, value);
  };
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <p className={styles.description}>{m.password_description({ name: request.fileName })}</p>
      <input
        ref={inputRef}
        type="password"
        className={styles.input}
        aria-label={m.password_label()}
        aria-invalid={request.incorrect || undefined}
        aria-describedby={request.incorrect ? 'compact-password-error' : undefined}
        autoComplete="off"
        enterKeyHint="go"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {request.incorrect ? (
        <p id="compact-password-error" className={styles.error}>
          {m.password_incorrect()}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button
          type="button"
          className={`${controls.text} ${controls.quiet}`}
          onClick={() => answerPassword(request.id, null)}
        >
          {m.password_skip()}
        </button>
        <button type="submit" className={controls.primary}>
          {m.password_open()}
        </button>
      </div>
    </form>
  );
}
