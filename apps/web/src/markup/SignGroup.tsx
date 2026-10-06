/**
 * The Fill & sign group (`03-markup` MK-12, MK-14; flows §4.3): Sign ▾, the saved-signature
 * chips, the field stepper, Add field ▾ and Show field outlines.
 *
 * - **Sign ▾** (MK-12): a press arms the signature of this session, else the newest saved one,
 *   else opens New signature (S7); a press on it armed, ↑, a right-click or a long press opens
 *   its menu: the saved signatures (≤ 5, each with its plate), New signature…, Certificate…
 *   and Saved signatures… (Settings).
 * - **Chips** (MK-12 §2): with the Fill & sign door, up to three saved signatures newest first,
 *   each its page-white plate in a bar-high pill. Inline in the row from large up; when the row
 *   has no room they move to the ink strip's row while Select is armed (03.7). A press arms
 *   it as a one-shot `place` tool; a click on the page places it, then Select (J8A 3).
 * - **Stepper** `‹ 3 / 12 ›` (MK-14): the previous or next fillable field in tab order, opened
 *   so typing fills (`targeted`); the ends wrap. Before a field is focused the readout counts
 *   the fields ("12 fields"). Absent without fields.
 * - **Add field ▾**: a field kind arms a one-shot `place` tool (`forms.add.*`).
 * - **Show field outlines**: the same flag as before (`forms.highlight`), `aria-pressed`;
 *   disabled with its reason when the file has no fields.
 */
import { Menu } from '@base-ui/react/menu';
import type { CreatedFieldKind, PageId } from '@pdf-editor/document-model';
import { getActiveDocument } from '@pdf-editor/document-model';
import { createContext, useContext, useEffect, useState } from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import { activateTool } from '../annotations/commands';
import { toolDefinition } from '../annotations/tools';
import { commandRegistry } from '../commands/registry';
import { FIELD_KINDS, kindName } from '../forms/create';
import { documentSources, fieldStops, isFillable, useFormStore } from '../forms/form-store';
import { moveField } from '../forms/navigation';
import { formatNumber, m } from '../i18n';
import { openSettings } from '../settings/open-settings';
import { openNewSignature } from '../signatures/new-signature';
import {
  armedSavedSignature,
  armSavedSignature,
  loadSavedSignatures,
  type SavedSignature,
  signatureLabel,
  useSavedSignatures,
} from '../signatures/saved-signatures';
import { SignaturePlate } from '../signatures/SignaturePlate';
import { useWorkspaceStore } from '../state/workspace-store';
import { Icon, type IconName } from '../ui/Icon';
import menuStyles from '../ui/Menu.module.css';
import { Tooltip } from '../ui/Tooltip';
import { useToolStore } from '../viewer/tool-store';
import { ChoiceTool } from './ChoiceTool';
import { abovePalette } from './anchor';
import styles from './MarkupPalette.module.css';
import { armedTooltip, PaletteButton } from './ToolButton';

/** How many saved signatures show as chips (03.Q1: three). */
export const CHIP_COUNT = 3;

/**
 * Whether the palette's pieces may start loading what they show (the saved signatures, the
 * fields' sources). False inside the palette's measurer, which lays them out with whatever is
 * already loaded and never starts a load of its own.
 */
export const PaletteLoads = createContext(true);

/**
 * The saved signatures, loaded once the palette shows. With `load` false (or under
 * `PaletteLoads` false), only those already loaded.
 */
export function useSignatures(loadHere = true): readonly SavedSignature[] {
  const signatures = useSavedSignatures((s) => s.signatures);
  const load = useContext(PaletteLoads) && loadHere;
  useEffect(() => {
    if (load) void loadSavedSignatures();
  }, [load]);
  return signatures;
}

/** The id of the armed saved signature, if one is. */
function useArmedSignature(): string | null {
  const mode = useToolStore((s) => s.mode);
  const pending = useAnnotationStore((s) => s.pendingStamp);
  return armedSavedSignature(mode, pending);
}

export function SignButton({
  showLabel,
  chipsShown,
}: {
  readonly showLabel: boolean;
  /** The chips in the row: a signature armed from one shows on its chip, not here. */
  readonly chipsShown: boolean;
}) {
  const signatures = useSignatures();
  const mode = useToolStore((s) => s.mode);
  const armedId = useArmedSignature();
  const tool = toolDefinition('signature');
  const onChip = chipsShown && signatures.slice(0, CHIP_COUNT).some((s) => s.id === armedId);
  const armed = mode === 'signature' && !onChip;
  return (
    <ChoiceTool
      label={tool.title()}
      tooltip={tool.tooltip?.() ?? tool.title()}
      icon={<Icon name="signature" />}
      armed={armed}
      command="tool.signature"
      item="sign"
      tool="signature"
      showLabel={showLabel}
      onArm={() => activateTool(tool)}
    >
      {signatures.map((signature) => (
        <Menu.Item
          key={signature.id}
          className={menuStyles.item}
          data-checked={armedId === signature.id ? '' : undefined}
          onClick={() => void armSavedSignature(signature.id)}
        >
          <SignaturePlate ink={signature} />
          <span className={menuStyles.label}>{signatureLabel(signature)}</span>
        </Menu.Item>
      ))}
      {signatures.length > 0 ? <Menu.Separator className={menuStyles.separator} /> : null}
      <Menu.Item className={menuStyles.item} onClick={() => openNewSignature()}>
        <Icon name="plus" className={styles.menuIcon} />
        <span className={menuStyles.label}>{m.signature_menu_new()}</span>
      </Menu.Item>
      <Menu.Item
        className={menuStyles.item}
        onClick={() => void commandRegistry.execute('document.sign')}
      >
        <Icon name="seal-check" className={styles.menuIcon} />
        <span className={menuStyles.label}>{m.markup_certificate()}</span>
      </Menu.Item>
      {signatures.length > 0 ? (
        <Menu.Item
          className={menuStyles.item}
          onClick={() => openSettings({ row: 'savedSignatures' })}
        >
          <Icon name="gear-six" className={styles.menuIcon} />
          <span className={menuStyles.label}>{m.signature_menu_manage()}</span>
        </Menu.Item>
      ) : null}
    </ChoiceTool>
  );
}

/** The newest saved signatures as chips (module header). */
export function SignatureChips({ item }: { readonly item?: string | undefined }) {
  const signatures = useSignatures();
  const armedId = useArmedSignature();
  const chips = signatures.slice(0, CHIP_COUNT);
  if (chips.length === 0) return null;
  return (
    <span className={styles.chips} data-item={item} data-signature-chips="">
      {chips.map((signature) => {
        const label = signatureLabel(signature);
        const armed = armedId === signature.id;
        return (
          <Tooltip key={signature.id} label={armedTooltip(label, armed)} side="top">
            <button
              type="button"
              className={styles.signatureChip}
              aria-label={label}
              aria-pressed={armed}
              data-tool="saved-signature"
              data-saved-signature={signature.id}
              onClick={() => void armSavedSignature(signature.id)}
            >
              <SignaturePlate ink={signature} />
            </button>
          </Tooltip>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/**
 * The fillable fields of the active document, in tab order; their sources load on demand
 * (with `load` false, or under `PaletteLoads` false, only the sources already loaded).
 */
export function useFieldStops(loadHere = true) {
  const doc = useWorkspaceStore((s) => getActiveDocument(s.workspace));
  const sources = useFormStore((s) => s.sources);
  const load = useContext(PaletteLoads) && loadHere;
  useEffect(() => {
    if (!doc || !load) return;
    for (const source of documentSources(doc)) useFormStore.getState().ensureSource(source);
  }, [doc, load]);
  return doc ? fieldStops(doc, sources).filter((stop) => isFillable(stop.field)) : [];
}

/** Moves to the previous or next field from the focused one (or from the start). */
export function stepField(direction: 1 | -1): void {
  const from = useFormStore.getState().active ?? {
    name: '',
    widget: -1,
    pageId: '' as PageId,
  };
  moveField(from, direction);
}

export function FieldStepper({ countLabel }: { readonly countLabel: boolean }) {
  const stops = useFieldStops();
  const active = useFormStore((s) => s.active);
  if (stops.length === 0) return null;
  const index = active
    ? stops.findIndex(
        (s) =>
          s.source === active.source &&
          s.fieldId === active.fieldId &&
          s.name === active.name &&
          s.widget === active.widget &&
          s.pageId === active.pageId,
      )
    : -1;
  const total = stops.length;
  const readout =
    index >= 0
      ? m.markup_field_position({ n: formatNumber(index + 1), total: formatNumber(total) })
      : countLabel
        ? m.markup_field_count({ count: total })
        : formatNumber(total);
  const name =
    index >= 0
      ? m.markup_field_named({
          n: formatNumber(index + 1),
          total: formatNumber(total),
          name: stops[index]?.name ?? '',
        })
      : m.markup_field_count({ count: total });
  return (
    <span
      role="group"
      aria-label={m.markup_fields()}
      className={styles.stepper}
      data-item="stepper"
    >
      <PaletteButton
        label={m.markup_field_previous()}
        icon={<Icon name="caret-left" />}
        onClick={() => stepField(-1)}
        data-field-step="previous"
      />
      <span className={styles.stepperReadout} aria-live="polite" aria-label={name}>
        {readout}
      </span>
      <PaletteButton
        label={m.markup_field_next()}
        icon={<Icon name="caret-right" />}
        onClick={() => stepField(1)}
        data-field-step="next"
      />
    </span>
  );
}

/** Each field kind's glyph in Add field ▾ (MK-14 §2). */
export const FIELD_KIND_ICON: Readonly<Record<CreatedFieldKind, IconName>> = {
  text: 'textbox',
  checkbox: 'check-square',
  radio: 'radio-button',
  dropdown: 'caret-circle-down',
  listbox: 'list',
  signature: 'signature',
  button: 'cursor-click',
};

export function AddFieldMenu() {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  return (
    <Menu.Root>
      <Menu.Trigger
        ref={setTrigger}
        render={
          <PaletteButton
            label={m.forms_add_field()}
            icon={<Icon name="plus-square" />}
            item="add-field"
            className={styles.choice}
          />
        }
      />
      <Menu.Portal>
        <Menu.Positioner
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={8}
          anchor={abovePalette(() => trigger)}
        >
          <Menu.Popup className={menuStyles.popup} data-annotation-keep="">
            {FIELD_KINDS.map((kind) => (
              <Menu.Item
                key={kind}
                className={menuStyles.item}
                onClick={() => void commandRegistry.execute(`forms.add.${kind}`)}
              >
                <Icon name={FIELD_KIND_ICON[kind]} className={styles.menuIcon} />
                <span className={menuStyles.label}>{kindName(kind)}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function OutlinesButton({ hasFields }: { readonly hasFields: boolean }) {
  const on = useFormStore((s) => s.highlight);
  const label = m.markup_field_outlines();
  return (
    <PaletteButton
      label={label}
      tooltip={hasFields ? label : `${label} · ${m.markup_no_fields()}`}
      icon={<Icon name="selection" />}
      item="outlines"
      aria-pressed={hasFields && on}
      aria-disabled={hasFields ? undefined : 'true'}
      aria-description={hasFields ? undefined : m.markup_no_fields()}
      data-command="forms.highlight"
      onClick={() => {
        if (hasFields) void commandRegistry.execute('forms.highlight');
      }}
    />
  );
}
