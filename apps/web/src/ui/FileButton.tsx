/**
 * FileButton (system-audit-2026-10 §4 Forms; quality-bar Q-9, Q-14): a standard `Button` that
 * opens a hidden `<input type="file">`, so the browser's own "Choose File · No file chosen"
 * control never shows. The chosen file's name belongs to the caller, as the row's value or
 * description (the certificate sheet's "Certificate · ada.p12 · Change…", 07-sheets S8).
 *
 * - The input is hidden and out of the tab order; the button is the one focusable control and
 *   takes the ref, so a form can focus it when a file is missing.
 * - The input's value is cleared after each pick, so choosing the same file again still
 *   reports it. A cancelled pick reports nothing.
 */
import { type Ref, useRef } from 'react';

import { Button, type ButtonProps } from './Button';

export interface FileButtonProps extends Omit<ButtonProps, 'onClick' | 'type' | 'ref'> {
  /** The `accept` list of the hidden input (".p12,.pfx,application/x-pkcs12"). */
  readonly accept: string;
  readonly multiple?: boolean;
  /** The files picked; never called for a cancelled pick. */
  readonly onFiles: (files: File[]) => void;
  readonly ref?: Ref<HTMLButtonElement>;
  /** `data-testid` on the hidden input, for tests that set files on it. */
  readonly inputTestId?: string | undefined;
}

export function FileButton({
  accept,
  multiple = false,
  onFiles,
  inputTestId,
  disabled = false,
  ...button
}: FileButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button {...button} disabled={disabled} onClick={() => input.current?.click()} />
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        data-testid={inputTestId}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
    </>
  );
}
