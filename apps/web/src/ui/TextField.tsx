/**
 * Text field and text area (09-primitives §12): free text such as a file or section name, a
 * password, metadata, a signature name or a comment author. They replace the native text
 * inputs and textareas of today's chrome and dialogs.
 *
 * - **Anatomy.** The label above (12/16 at 500, secondary; "Optional" or "Required" after it),
 *   the opaque well (`Field.module.css`, 32 / 44 px, 13 / 16 px text), and the description
 *   below; an error replaces the description in the danger colour with an `x-circle` glyph.
 *   `hideLabel` keeps the label for assistive technology only (dense rows with a visible
 *   label elsewhere).
 * - **Password.** A trailing show / hide button ("Show password", "Hide password").
 * - **Text area.** At least three lines, growing to eight with its content, then scrolling.
 * - **Esc ladder.** The first Esc restores the value the field had when it took focus and
 *   keeps the key; once nothing differs, Esc passes on and closes the surface.
 * - `selectOnFocus` selects the text when the field takes focus (rename).
 * - Wiring: the label names the input, the description or error describes it, and an error
 *   sets `aria-invalid`.
 */
import { CircleX, Eye, EyeOff } from 'lucide-react';
import {
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from 'react';

import { m } from '../i18n';
import styles from './Field.module.css';

interface FieldFrameProps {
  /** The visible label and the accessible name. */
  readonly label: string;
  readonly hideLabel?: boolean | undefined;
  readonly description?: ReactNode;
  /** An error message; replaces the description and marks the field invalid. */
  readonly error?: string | null | undefined;
  /** Mark the label "Optional". */
  readonly optional?: boolean | undefined;
  readonly className?: string | undefined;
}

type NativeInput = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'className' | 'children' | 'type' | 'size'
>;

export interface TextFieldProps extends FieldFrameProps, NativeInput {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly type?: 'text' | 'password' | 'email' | 'url' | 'tel' | undefined;
  readonly selectOnFocus?: boolean | undefined;
  readonly inputClassName?: string | undefined;
}

/** The Esc ladder: restore once, then let the key close the surface. */
function useEscRestore(value: string, onValueChange: (value: string) => void) {
  const atFocus = useRef<string | null>(null);
  return {
    onFocus: () => {
      atFocus.current = value;
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || atFocus.current === null || atFocus.current === value) return;
      event.preventDefault();
      event.stopPropagation();
      onValueChange(atFocus.current);
    },
  };
}

function useFieldIds(id: string | undefined) {
  const own = useId();
  const inputId = id ?? `${own}-input`;
  return { inputId, labelId: `${own}-label`, noteId: `${own}-note` };
}

function FieldFrame({
  label,
  hideLabel,
  description,
  error,
  optional,
  required,
  className,
  ids,
  children,
}: FieldFrameProps & {
  readonly required: boolean;
  readonly ids: ReturnType<typeof useFieldIds>;
  readonly children: ReactNode;
}) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label
        id={ids.labelId}
        htmlFor={ids.inputId}
        className={hideLabel ? 'visually-hidden' : styles.label}
      >
        {label}
        {optional || required ? (
          <span className={styles.optional}>
            {' · '}
            {required ? m.field_required() : m.field_optional()}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={ids.noteId} className={styles.error}>
          <CircleX aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : description ? (
        <p id={ids.noteId} className={styles.description}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  value,
  onValueChange,
  label,
  hideLabel,
  description,
  error,
  optional,
  className,
  inputClassName,
  type = 'text',
  selectOnFocus = false,
  id,
  required = false,
  disabled,
  readOnly,
  onFocus,
  onKeyDown,
  ...rest
}: TextFieldProps) {
  const ids = useFieldIds(id);
  const esc = useEscRestore(value, onValueChange);
  const [shown, setShown] = useState(false);
  const password = type === 'password';
  const described = error || description ? ids.noteId : undefined;
  return (
    <FieldFrame
      label={label}
      hideLabel={hideLabel}
      description={description}
      error={error}
      optional={optional}
      required={required}
      className={className}
      ids={ids}
    >
      <div
        className={styles.well}
        data-invalid={error ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-readonly={readOnly ? '' : undefined}
      >
        <input
          {...rest}
          id={ids.inputId}
          type={password && shown ? 'text' : type}
          className={[styles.input, inputClassName].filter(Boolean).join(' ')}
          value={value}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [rest['aria-describedby'], described].filter(Boolean).join(' ') || undefined
          }
          onChange={(event) => onValueChange(event.currentTarget.value)}
          onFocus={(event: FocusEvent<HTMLInputElement>) => {
            esc.onFocus();
            if (selectOnFocus) event.currentTarget.select();
            onFocus?.(event);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented) esc.onKeyDown(event);
          }}
        />
        {password ? (
          <button
            type="button"
            className={styles.wellButton}
            aria-label={shown ? m.field_hide_password() : m.field_show_password()}
            aria-pressed={shown}
            disabled={disabled}
            onClick={() => setShown((s) => !s)}
          >
            {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        ) : null}
      </div>
    </FieldFrame>
  );
}

type NativeTextArea = Omit<
  ComponentPropsWithRef<'textarea'>,
  'value' | 'defaultValue' | 'onChange' | 'className' | 'children'
>;

export interface TextAreaProps extends FieldFrameProps, NativeTextArea {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly inputClassName?: string | undefined;
}

export function TextArea({
  value,
  onValueChange,
  label,
  hideLabel,
  description,
  error,
  optional,
  className,
  inputClassName,
  id,
  required = false,
  disabled,
  readOnly,
  onFocus,
  onKeyDown,
  ...rest
}: TextAreaProps) {
  const ids = useFieldIds(id);
  const esc = useEscRestore(value, onValueChange);
  const described = error || description ? ids.noteId : undefined;
  return (
    <FieldFrame
      label={label}
      hideLabel={hideLabel}
      description={description}
      error={error}
      optional={optional}
      required={required}
      className={className}
      ids={ids}
    >
      <div
        className={styles.well}
        data-invalid={error ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-readonly={readOnly ? '' : undefined}
      >
        <textarea
          {...rest}
          id={ids.inputId}
          className={[styles.textarea, inputClassName].filter(Boolean).join(' ')}
          value={value}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [rest['aria-describedby'], described].filter(Boolean).join(' ') || undefined
          }
          onChange={(event) => onValueChange(event.currentTarget.value)}
          onFocus={(event) => {
            esc.onFocus();
            onFocus?.(event);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented) esc.onKeyDown(event);
          }}
        />
      </div>
    </FieldFrame>
  );
}
