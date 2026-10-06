/**
 * More tools, + (`03-markup` MK-10): whatever the fold put away at this width, by group, each
 * item with its key; then the rare commands (Find sensitive data…, Certificate…). Every tool
 * stays reachable at every width (A-20).
 *
 * When the armed tool lives here, + shows its glyph, filled and armed (the *replace* of the
 * glyph), and its name says so: "More tools, Note armed". Choosing an item arms it through its
 * command, so it opens Markup, refuses on a locked document and says what it armed exactly as
 * its key does. Focus goes back to +.
 */
import { Menu } from '@base-ui/react/menu';
import { Fragment, type ReactNode, useState } from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import { armBuiltinStamp } from '../annotations/commands';
import { isHighlighter } from '../annotations/pen/presets';
import { BUILTIN_STAMPS } from '../annotations/stamps';
import { toolDefinition } from '../annotations/tools';
import { commandRegistry } from '../commands/registry';
import { FIELD_KINDS, kindName } from '../forms/create';
import { useFormStore } from '../forms/form-store';
import { m } from '../i18n';
import { openNewSignature } from '../signatures/new-signature';
import { Icon, type IconName } from '../ui/Icon';
import menuStyles from '../ui/Menu.module.css';
import { type PaletteGroup, SHAPE_MODES, type ToolMode, useToolStore } from '../viewer/tool-store';
import { GROUP_LABEL, ITEM_GROUP, type PaletteItem } from './palette-groups';
import { abovePalette } from './anchor';
import styles from './MarkupPalette.module.css';
import { FIELD_KIND_ICON, stepField } from './SignGroup';
import { PaletteButton, shortcutOf } from './ToolButton';
import { Keycaps } from '../ui/Keycaps';

/** The palette item that holds the armed tool (the + glyph rule). */
export function itemOfMode(mode: ToolMode, highlighter: boolean): PaletteItem | null {
  switch (mode) {
    case 'select':
      return 'select';
    case 'ink':
      return highlighter ? 'highlighter' : 'pens';
    case 'rectangle':
    case 'ellipse':
    case 'line':
    case 'arrow':
      return 'shapes';
    case 'signature':
      return 'sign';
    case 'eraser':
    case 'lasso':
    case 'text-box':
    case 'note':
    case 'image':
    case 'stamp':
    case 'edit-text':
    case 'redact':
      return mode;
    default:
      return null;
  }
}

function Item({
  icon,
  label,
  command,
  onClick,
  checked,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly command?: string | undefined;
  readonly onClick: () => void;
  readonly checked?: boolean | undefined;
}) {
  const shortcut = command === undefined ? undefined : shortcutOf(command);
  return (
    <Menu.Item
      className={menuStyles.item}
      data-checked={checked ? '' : undefined}
      onClick={onClick}
    >
      <Icon name={icon} className={styles.menuIcon} />
      <span className={menuStyles.label}>{label}</span>
      {shortcut ? <Keycaps shortcut={shortcut} tone="quiet" /> : null}
    </Menu.Item>
  );
}

const run = (id: string) => () => void commandRegistry.execute(id);

/** A folded tool armed by its command (`tool.eraser`, …). */
function ToolItem({ mode }: { readonly mode: ToolMode }) {
  const tool = toolDefinition(mode);
  const armed = useToolStore((s) => s.mode === mode);
  return (
    <Item
      icon={tool.icon}
      label={tool.title()}
      command={`tool.${mode}`}
      checked={armed}
      onClick={run(`tool.${mode}`)}
    />
  );
}

/** The menu entries of one folded item. */
function entries(item: PaletteItem): ReactNode {
  switch (item) {
    case 'highlighter':
      return (
        <Item
          icon="highlighter"
          label={m.tool_highlighter()}
          command="tool.highlighter"
          onClick={run('tool.highlighter')}
        />
      );
    case 'eraser':
    case 'lasso':
    case 'text-box':
    case 'note':
    case 'image':
    case 'edit-text':
    case 'redact':
      return <ToolItem mode={item} />;
    case 'shapes':
      return SHAPE_MODES.map((mode) => <ToolItem key={mode} mode={mode} />);
    case 'stamp':
      return (
        <>
          {BUILTIN_STAMPS.map((stamp) => (
            <Item
              key={stamp.name}
              icon="stamp"
              label={stamp.label()}
              onClick={() => armBuiltinStamp(stamp.name)}
            />
          ))}
          <Item icon="image" label={m.stamp_image()} onClick={run('stamp.image')} />
        </>
      );
    case 'sign':
      return (
        <>
          <ToolItem mode="signature" />
          <Item icon="plus" label={m.signature_menu_new()} onClick={() => openNewSignature()} />
        </>
      );
    case 'add-field':
      return FIELD_KINDS.map((kind) => (
        <Item
          key={kind}
          icon={FIELD_KIND_ICON[kind]}
          label={kindName(kind)}
          onClick={run(`forms.add.${kind}`)}
        />
      ));
    case 'outlines':
      return <OutlinesItem />;
    case 'stepper':
      return (
        <>
          <Item icon="caret-left" label={m.markup_field_previous()} onClick={() => stepField(-1)} />
          <Item icon="caret-right" label={m.markup_field_next()} onClick={() => stepField(1)} />
        </>
      );
    default:
      return null;
  }
}

function OutlinesItem() {
  const on = useFormStore((s) => s.highlight);
  return (
    <Item
      icon="selection"
      label={m.markup_field_outlines()}
      checked={on}
      onClick={run('forms.highlight')}
    />
  );
}

export function MoreTools({ folded }: { readonly folded: readonly PaletteItem[] }) {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const mode = useToolStore((s) => s.mode);
  const highlighter = useAnnotationStore((s) => isHighlighter(s.pen.presets[s.pen.active]));
  const armedItem = itemOfMode(mode, highlighter);
  const armedHere = armedItem !== null && armedItem !== 'select' && folded.includes(armedItem);
  const armedTool = armedHere
    ? armedItem === 'highlighter'
      ? m.tool_highlighter()
      : toolDefinition(mode).title()
    : null;
  const icon: IconName = armedHere
    ? armedItem === 'highlighter'
      ? 'highlighter'
      : toolDefinition(mode).icon
    : 'plus';
  const groups = new Map<PaletteGroup, PaletteItem[]>();
  for (const item of folded) {
    const group = ITEM_GROUP[item];
    if (group === 'done' || group === 'more' || item === 'chips') continue;
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  const label = armedTool ? m.markup_more_tools_armed({ tool: armedTool }) : m.markup_more_tools();
  return (
    <Menu.Root>
      <Menu.Trigger
        ref={setTrigger}
        render={
          <PaletteButton
            label={label}
            icon={<Icon name={icon} />}
            item="more"
            tool={armedHere ? 'more' : undefined}
            aria-pressed={armedHere ? true : undefined}
            data-more-tools=""
          />
        }
      />
      <Menu.Portal>
        <Menu.Positioner
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          anchor={abovePalette(() => trigger)}
        >
          <Menu.Popup className={menuStyles.popup} data-annotation-keep="" data-more-menu="">
            {[...groups.entries()].map(([group, items]) => (
              <Menu.Group key={group}>
                <Menu.GroupLabel className={styles.menuHeading}>
                  {GROUP_LABEL[group]()}
                </Menu.GroupLabel>
                {items.map((item) => (
                  <Fragment key={item}>{entries(item)}</Fragment>
                ))}
              </Menu.Group>
            ))}
            {groups.size > 0 ? <Menu.Separator className={menuStyles.separator} /> : null}
            <Item
              icon="scan"
              label={m.markup_find_sensitive()}
              command="redaction.find"
              onClick={run('redaction.find')}
            />
            <Item icon="seal-check" label={m.markup_certificate()} onClick={run('document.sign')} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
