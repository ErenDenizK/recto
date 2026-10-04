/**
 * The control primitives' gallery (quality-bar Q-13; spec redesign D0-3): every primitive of
 * D0-3 part 1 in its states, on the canvas and on today's floating glass, for the screenshot
 * baselines of `e2e/surfaces.visual.spec.ts`. Elements marked `data-force` get that pseudo-class
 * forced by the spec through CDP (`hover`, `active`, `focus-visible`), so hover, pressed and focus
 * show side by side. Served by the spec's own Vite dev server; not an app route, never built.
 */
import '@fontsource-variable/inter/wght.css';
import '../../src/styles/fonts.css';
import '../../src/styles/tokens.css';
import '../../src/styles/reset.css';
import '../../src/styles/global.css';

import { Lock, Save, Trash2, Undo2 } from 'lucide-react';
import { type ReactNode, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { parseShortcut } from '../../src/commands/shortcuts';
import { Avatar } from '../../src/ui/Avatar';
import { Badge } from '../../src/ui/Badge';
import { Button } from '../../src/ui/Button';
import { Checkbox } from '../../src/ui/Checkbox';
import { Chip, ChipGroup } from '../../src/ui/Chip';
import { EmptyNote } from '../../src/ui/EmptyNote';
import { IconButton } from '../../src/ui/IconButton';
import { Keycaps } from '../../src/ui/Keycaps';
import { Progress } from '../../src/ui/Progress';
import { RadioGroup } from '../../src/ui/RadioGroup';
import { Switch } from '../../src/ui/Switch';
import { DotStack, Tag } from '../../src/ui/Tag';
import { TooltipProvider } from '../../src/ui/Tooltip';

function Row({ name, children }: { readonly name: string; readonly children: ReactNode }) {
  return (
    <section data-row={name} style={{ display: 'contents' }}>
      <h2
        style={{
          alignSelf: 'center',
          color: 'var(--text-secondary)',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        {name}
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function Buttons({ variant }: { readonly variant: 'prominent' | 'standard' | 'quiet' | 'danger' }) {
  const label =
    variant === 'danger' ? 'Delete page' : variant === 'prominent' ? 'Save copy' : 'Cancel';
  const icon = variant === 'danger' ? <Trash2 /> : <Save />;
  return (
    <>
      <Button variant={variant} icon={icon}>
        {label}
      </Button>
      <Button variant={variant} data-force="hover">
        {label}
      </Button>
      <Button variant={variant} data-force="active">
        {label}
      </Button>
      <Button variant={variant} data-force="focus-visible">
        {label}
      </Button>
      <Button variant={variant} disabled reason="Choose at least one page">
        {label}
      </Button>
    </>
  );
}

function Gallery() {
  const [filter, setFilter] = useState<'all' | 'comments' | 'marks'>('comments');
  const [size, setSize] = useState<'same' | 'smaller'>('smaller');
  return (
    <main
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        gap: '16px 24px',
        padding: 24,
        width: 'fit-content',
      }}
    >
      <Row name="Prominent">
        <Buttons variant="prominent" />
      </Row>
      <Row name="Standard">
        <Buttons variant="standard" />
      </Row>
      <Row name="Quiet">
        <Buttons variant="quiet" />
      </Row>
      <Row name="Danger">
        <Buttons variant="danger" />
      </Row>
      <Row name="Busy, blocked">
        <Button variant="prominent" busy busyLabel="Saving…">
          Save
        </Button>
        <Button blocked={{ reason: 'Locked · Unlock', onPress: () => undefined }} icon={<Lock />}>
          Delete page
        </Button>
        <Button size="lg" variant="prominent">
          Open files…
        </Button>
      </Row>
      <Row name="On glass">
        <div
          className="glass"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '0 calc((var(--bar-h) - var(--bar-button) - 2px) / 2)',
            borderRadius: 999,
            height: 'var(--bar-h)',
          }}
        >
          <Button variant="standard">Copy</Button>
          <Button variant="danger">Delete</Button>
          <IconButton label="Undo" icon={<Undo2 />} />
          <IconButton label="Pen" icon={<Save />} aria-pressed data-tool="ink" />
        </div>
      </Row>
      <Row name="IconButton">
        <IconButton label="Undo" icon={<Undo2 />} />
        <IconButton label="Undo" icon={<Undo2 />} data-force="hover" />
        <IconButton label="Undo" icon={<Undo2 />} data-force="active" />
        <IconButton label="Undo" icon={<Undo2 />} data-force="focus-visible" />
        <IconButton label="Undo" icon={<Undo2 />} aria-pressed />
        <IconButton label="Undo" icon={<Undo2 />} aria-disabled />
        <IconButton label="Close" icon={<Undo2 />} size="row" />
      </Row>
      <Row name="Chips">
        <ChipGroup
          label="Show"
          value={filter}
          onChange={setFilter}
          chips={[
            { value: 'all', label: 'All', count: '5' },
            { value: 'comments', label: 'Comments', count: '2' },
            { value: 'marks', label: 'Marks', count: '3', disabled: true },
          ]}
        />
        <Chip label="Signature 1" onRemove={() => undefined} />
        <Chip label="Hover" pressed={false} />
      </Row>
      <Row name="Switch">
        <div style={{ width: 240 }}>
          <Switch label="Reduce motion" checked={false} onCheckedChange={() => undefined} />
          <Switch label="Draw with finger" checked onCheckedChange={() => undefined} />
          <Switch label="Reduce motion" checked system onCheckedChange={() => undefined} />
          <Switch label="Lock" checked={false} busy onCheckedChange={() => undefined} />
        </div>
      </Row>
      <Row name="Checkbox">
        <div style={{ width: 240 }}>
          <Checkbox label="Remove metadata" checked onCheckedChange={() => undefined} />
          <Checkbox label="Flatten forms" checked={false} onCheckedChange={() => undefined} />
          <Checkbox label="All steps" indeterminate checked={false} />
          <Checkbox label="Disabled" disabled checked={false} />
          <Checkbox label="Required" error="Choose at least one" checked={false} />
        </div>
      </Row>
      <Row name="Radio group">
        <div style={{ width: 280 }}>
          <RadioGroup
            label="Size"
            value={size}
            onValueChange={setSize}
            options={[
              { value: 'same', label: 'Same as original' },
              { value: 'smaller', label: 'Smaller', detail: 'about 1.1 MB' },
            ]}
          />
        </div>
      </Row>
      <Row name="Keycaps, badges">
        <Keycaps shortcut={parseShortcut('Mod+Shift+S')} platform="other" />
        <Keycaps shortcut={parseShortcut('Mod+K')} platform="mac" tone="onGlass" />
        <Badge count={3} />
        <Badge count={120} />
        <Badge kind="dot" />
        <Badge kind="status" tone="success" icon={<Lock />}>
          Valid
        </Badge>
      </Row>
      <Row name="Tags, avatars">
        <Tag index={0} name="report.pdf" />
        <Tag index={2} name="agreement.pdf" />
        <DotStack indexes={[0, 1, 2, 3, 4]} />
        <Avatar name="Deniz" index={1} />
        <Avatar name="ilke" index={3} size={24} />
        <Avatar name={null} index={0} size={32} />
      </Row>
      <Row name="Progress">
        <div style={{ display: 'grid', gap: 12, width: 280 }}>
          <Progress value={40} label="Exporting…" />
          <Progress value={100} label="Done" />
        </div>
      </Row>
      <Row name="Empty note">
        <div style={{ width: 280 }}>
          <EmptyNote
            title="No comments, marks or fields"
            body="Select text and choose Comment to add one."
            action={{ label: 'Recognize text…', onClick: () => undefined }}
          />
        </div>
      </Row>
    </main>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <TooltipProvider>
        <Gallery />
      </TooltipProvider>
    </StrictMode>,
  );
}
