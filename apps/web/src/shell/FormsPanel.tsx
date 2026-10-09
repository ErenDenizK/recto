/**
 * Form fields in the Review tab (spec document-tools §1, experience-redesign §4.1): every
 * form field shown by the active document is a row of the Review list, with a type icon,
 * its name (the /TU tooltip when it has one), its value and a required marker. Activating
 * a row shows the page in Read mode and opens the field's editor.
 *
 * The Fields filter's toolbar: "Highlight fields" (translucent fill over the widgets), "Clear all" (one
 * history entry) and "Flatten on export" (read by the export dialog). These, and "Edit
 * fields", show only when the document has fields (experience-redesign §4.1); otherwise
 * the panel says so and offers "Add field".
 *
 * XFA honesty: a source with /XFA and AcroForm widgets fills through the AcroForm (a
 * badge explains that export removes the XFA part); one without widgets shows that no
 * browser engine can edit it, and the form layer has nothing to offer.
 *
 * Field creation (M4, forms/create): "Add field" picks a kind to place on a page; "Edit
 * fields" makes created fields selectable (a row then selects its field) and shows their
 * tab-order buttons. Created fields list after the source fields of their page, tagged.
 */
import { Menu } from '@base-ui/react/menu';
import type { CreatedFieldKind, VirtualDocument } from '@pdf-editor/document-model';
import type { FormField, FormFieldKind } from '@pdf-editor/engine';

import { clearActiveForm } from '../forms';
import { fieldLabel } from '../forms/actions';
import { FIELD_KINDS, kindName, setDesign, startPlacing, useCreateStore } from '../forms/create';
import { stepTabOrder } from '../forms/create/field-actions';
import { documentSources, type FieldStop, isFillable, useFormStore } from '../forms/form-store';
import { openField } from '../forms/navigation';
import { m } from '../i18n';
import { useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Icon, type IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { ListRow } from '../ui/ListRow';
import { Notice } from '../ui/Notice';
import { Tooltip } from '../ui/Tooltip';
import menuStyles from '../ui/Menu.module.css';
import styles from './FormsPanel.module.css';
import { ReviewPanel } from './review/ReviewPanel';

const ICONS: Record<FormFieldKind, IconName> = {
  text: 'textbox',
  checkbox: 'check-square',
  radio: 'radio-button',
  combobox: 'caret-circle-down',
  listbox: 'list',
  button: 'cursor-click',
  signature: 'signature',
  unknown: 'question',
};

const CREATE_ICONS: Record<CreatedFieldKind, IconName> = {
  text: 'textbox',
  checkbox: 'check-square',
  radio: 'radio-button',
  dropdown: 'caret-circle-down',
  listbox: 'list',
  signature: 'signature',
  button: 'cursor-click',
};

/** The Review list on the Fields filter, without the filter chips. */
export function FormsPanel() {
  return <ReviewPanel filter="fields" />;
}

/** The value of a field as the list shows it. */
export function valueText(field: FormField): { text: string; empty: boolean } {
  const v = field.value;
  switch (field.kind) {
    case 'checkbox':
      return { text: v === true ? m.forms_checked() : m.forms_unchecked(), empty: v !== true };
    case 'button':
      return { text: m.forms_kind_button(), empty: true };
    case 'signature':
      return field.signature
        ? { text: m.forms_signed(), empty: false }
        : { text: m.forms_signature_unsigned(), empty: true };
    default: {
      const text = typeof v === 'object' ? v.join(', ') : typeof v === 'string' ? v : '';
      if (text === '') return { text: m.forms_empty(), empty: true };
      return { text: field.password ? '••••••' : text, empty: false };
    }
  }
}

/** XFA facts of a document's sources: fill through the AcroForm, or nothing to fill. */
export function useXfa(doc: VirtualDocument | undefined): {
  readonly only: boolean;
  readonly withFields: boolean;
} {
  const sources = useFormStore((s) => s.sources);
  const flags = useWorkspaceStore((s) => s.workspace.sources);
  const xfa = (doc ? documentSources(doc) : []).filter((id) => flags[id]?.flags.hasXfa === true);
  return {
    only: xfa.some((id) => sources[id]?.loaded && sources[id]?.fields.length === 0),
    withFields: xfa.some((id) => (sources[id]?.fields.length ?? 0) > 0),
  };
}

/**
 * The Review tab's Fields filter header: "Add field", and with fields "Edit fields",
 * "Highlight fields", "Clear all" and "Flatten on export"; the XFA notes.
 */
export function FormTools({
  doc,
  rows,
}: {
  readonly doc: VirtualDocument;
  readonly rows: readonly FieldStop[];
}) {
  const xfa = useXfa(doc);
  return (
    <>
      <Toolbar
        fillable={rows.some((r) => isFillable(r.field))}
        hasFields={rows.length > 0}
        hasPages={doc.pages.length > 0}
      />
      {xfa.withFields ? <XfaBadge /> : null}
      {xfa.only ? <Notice className={styles.notice}>{m.forms_xfa_only()}</Notice> : null}
    </>
  );
}

function AddFieldMenu({ disabled }: { readonly disabled: boolean }) {
  const placing = useCreateStore((s) => s.placing);
  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={disabled}
        render={
          <Button
            size="sm"
            className={styles.toggle}
            icon={<Icon name="plus" />}
            aria-pressed={placing !== null}
            data-add-field=""
          >
            {m.forms_add_field()}
            <Icon name="caret-down" className={styles.caret} />
          </Button>
        }
      />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={4} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup}>
            {FIELD_KINDS.map((kind) => {
              return (
                <Menu.Item
                  key={kind}
                  className={menuStyles.item}
                  data-add-kind={kind}
                  onClick={() => startPlacing(kind)}
                >
                  <Icon name={CREATE_ICONS[kind]} />
                  <span className={menuStyles.label}>{kindName(kind)}</span>
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function Toolbar({
  fillable,
  hasFields,
  hasPages,
}: {
  readonly fillable: boolean;
  readonly hasFields: boolean;
  readonly hasPages: boolean;
}) {
  const highlight = useFormStore((s) => s.highlight);
  const flatten = useFormStore((s) => s.flattenOnExport);
  const design = useCreateStore((s) => s.design);
  const placing = useCreateStore((s) => s.placing);
  return (
    <div className={styles.toolbar} data-annotation-keep="">
      <div className={styles.buttons}>
        <AddFieldMenu disabled={!hasPages} />
        {hasFields || design ? (
          <Button
            size="sm"
            className={styles.toggle}
            icon={<Icon name="selection" />}
            aria-pressed={design}
            disabled={!hasPages}
            data-edit-fields=""
            onClick={() => setDesign(!design)}
          >
            {m.forms_design()}
          </Button>
        ) : null}
        {hasFields ? (
          <>
            <Button
              size="sm"
              className={styles.toggle}
              icon={<Icon name="highlighter" />}
              aria-pressed={highlight}
              onClick={() => useFormStore.getState().setHighlight(!highlight)}
            >
              {m.forms_highlight()}
            </Button>
            <Button
              size="sm"
              icon={<Icon name="eraser" />}
              disabled={!fillable}
              onClick={() => void clearActiveForm()}
            >
              {m.forms_clear_all()}
            </Button>
          </>
        ) : null}
      </div>
      {hasFields ? (
        <Checkbox
          checked={flatten}
          onCheckedChange={(on) => useFormStore.getState().setFlattenOnExport(on)}
          label={m.forms_flatten_on_export()}
        />
      ) : null}
      {placing !== null ? (
        <p className={styles.hint} role="status">
          {m.forms_create_placing({ kind: kindName(placing) })}
        </p>
      ) : null}
    </div>
  );
}

function XfaBadge() {
  return (
    <div className={styles.xfa}>
      <Tooltip label={m.forms_xfa_badge_explanation()}>
        <Button
          size="sm"
          variant="quiet"
          icon={<Icon name="info" />}
          aria-label={m.forms_xfa_badge_explanation()}
        >
          {m.badge_xfa()}
        </Button>
      </Tooltip>
      <span className={styles.xfaText}>{m.forms_xfa_acroform()}</span>
    </div>
  );
}

/** Shows a field: opens its editor, or in "Edit fields" selects a created field. */
function openRow(row: FieldStop): void {
  if (useCreateStore.getState().design && row.fieldId !== undefined) {
    // Edit fields: a created field's row selects it on its page.
    useCreateStore.getState().select({ fieldId: row.fieldId, widget: row.widget });
    useViewStore.getState().scrollToPage(row.pageId);
    return;
  }
  if (isFillable(row.field)) {
    openField(row);
    return;
  }
  useUiStore.getState().showSurface('page');
  useViewStore.getState().scrollToPage(row.pageId);
}

/**
 * One field: type icon, name (the /TU tooltip when it has one), required and tags, value;
 * in "Edit fields" a created field's tab-order buttons. `createdOnPage` are the created
 * fields' rows of the same page, in tab order.
 */
export function FieldRow({
  row,
  index,
  createdOnPage,
}: {
  readonly row: FieldStop;
  readonly index: number;
  readonly createdOnPage: readonly FieldStop[];
}) {
  const design = useCreateStore((s) => s.design);
  const selected = useCreateStore((s) => s.selected);
  const active = useFormStore((s) => s.active);
  const icon = ICONS[row.field.kind];
  const value = valueText(row.field);
  const label = fieldLabel(row.field);
  const current =
    row.fieldId !== undefined && design
      ? selected?.fieldId === row.fieldId
      : active?.name === row.name && active.pageId === row.pageId;
  const createdIndex = createdOnPage.indexOf(row);
  return (
    <li
      className={styles.row}
      data-review-kind="field"
      data-created-row={row.fieldId === undefined ? undefined : row.name}
      data-index={index}
    >
      <ListRow
        align="start"
        className={styles.item}
        current={current}
        data-field-row={row.name}
        title={label === row.name ? undefined : row.name}
        onClick={() => openRow(row)}
      >
        <span className={styles.icon} aria-hidden="true">
          <Icon name={icon} />
        </span>
        <span className={styles.body}>
          <span className={styles.name}>
            {label}
            {row.field.required ? (
              <span className={styles.required} title={m.forms_required()}>
                <span aria-hidden="true">*</span>
                <span className={styles.srOnly}>{m.forms_required()}</span>
              </span>
            ) : null}
            {row.field.readOnly ? (
              <span className={styles.tag}>{m.forms_read_only_tag()}</span>
            ) : null}
            {row.fieldId !== undefined ? (
              <span className={styles.tag}>{m.forms_created_tag()}</span>
            ) : null}
          </span>
          <span className={styles.value} data-empty={value.empty || undefined}>
            {row.fieldId !== undefined && row.field.kind === 'signature'
              ? m.forms_signature_placeholder()
              : value.text}
          </span>
        </span>
      </ListRow>
      {design && row.fieldId !== undefined ? (
        <span className={styles.order}>
          <IconButton
            size="row"
            label={m.forms_tab_earlier({ name: label })}
            icon={<Icon name="arrow-up" />}
            tooltipSide="left"
            disabled={createdIndex <= 0}
            onClick={() => row.fieldId && stepTabOrder(row.fieldId, -1)}
          />
          <IconButton
            size="row"
            label={m.forms_tab_later({ name: label })}
            icon={<Icon name="arrow-down" />}
            tooltipSide="left"
            disabled={createdIndex < 0 || createdIndex >= createdOnPage.length - 1}
            onClick={() => row.fieldId && stepTabOrder(row.fieldId, 1)}
          />
        </span>
      ) : null}
    </li>
  );
}
