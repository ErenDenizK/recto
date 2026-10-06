/**
 * The Sheet primitive's gallery (spec redesign D0-4; components/07-sheets.md §1.1; quality-bar
 * Q-7): one sheet of each kind over a page of text and colour, for `e2e/sheets.spec.ts` to
 * open per size class, swipe, sample frame by frame and photograph. A document switch makes
 * the drafts per document visible. Served by the spec's own Vite dev server; not an app route,
 * never built.
 */
import '../../src/styles/fonts.css';
import '../../src/styles/tokens.css';
import '../../src/styles/reset.css';
import '../../src/styles/global.css';

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Button } from '../../src/ui/Button';
import { Checkbox } from '../../src/ui/Checkbox';
import { Icon } from '../../src/ui/Icon';
import { RadioGroup } from '../../src/ui/RadioGroup';
import {
  ConfirmHost,
  confirm,
  Sheet,
  type SheetCloseReason,
  SheetField,
  type SheetKind,
  SheetResult,
  useSheetDraft,
} from '../../src/ui/sheet';
import { TooltipProvider } from '../../src/ui/Tooltip';

declare global {
  interface Window {
    /** Every close, with its reason, for the spec to read. */
    __sheetCloses: { id: string; reason: SheetCloseReason }[];
    /** The confirmation's answers. */
    __confirmAnswers: boolean[];
  }
}
window.__sheetCloses = [];
window.__confirmAnswers = [];

const TITLES: Record<Exclude<SheetKind, 'confirmation'>, string> = {
  tool: 'Page numbers',
  task: 'Save a copy',
  settings: 'Settings',
  overlay: 'Keyboard shortcuts',
  signature: 'New signature',
};

/** A sheet's body: a field and a choice kept as drafts per document, and a few rows. */
function Body({ kind, docId }: { readonly kind: SheetKind; readonly docId: string }) {
  const [name, setName] = useSheetDraft(`${kind}-name`, docId, 'Page 1 of N');
  const [position, setPosition] = useSheetDraft(`${kind}-position`, docId, 'bottom');
  const [flatten, setFlatten] = useSheetDraft(`${kind}-flatten`, docId, false);
  return (
    <div data-testid="sheet-content" style={{ display: 'grid', gap: 16 }}>
      <SheetField
        label="Format"
        showLabel
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <RadioGroup
        label="Position"
        value={position}
        onValueChange={setPosition}
        options={[
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom', detail: 'centred' },
        ]}
      />
      <Checkbox label="Flatten forms" checked={flatten} onCheckedChange={setFlatten} />
      {kind === 'overlay' || kind === 'settings'
        ? Array.from({ length: 14 }, (_, i) => (
            <p key={i} style={{ color: 'var(--text-secondary)' }}>
              Row {i + 1}: a line of settings text that fills the sheet.
            </p>
          ))
        : null}
    </div>
  );
}

function Gallery() {
  const [open, setOpen] = useState<Exclude<SheetKind, 'confirmation'> | null>(null);
  const [docId, setDocId] = useState('report');
  const [result, setResult] = useState(false);
  const close = (id: string) => (reason: SheetCloseReason) => {
    window.__sheetCloses.push({ id, reason });
    setOpen(null);
    setResult(false);
  };
  return (
    <TooltipProvider>
      <main
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          background: 'var(--canvas)',
        }}
      >
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            background: 'var(--canvas)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: 12,
          }}
          data-testid="launchers"
        >
          {(['tool', 'task', 'settings', 'overlay'] as const).map((kind) => (
            <Button key={kind} variant="standard" onClick={() => setOpen(kind)}>
              {`Open ${kind}`}
            </Button>
          ))}
          <Button
            variant="standard"
            onClick={() => {
              void confirm({
                title: 'Revert to the opened version?',
                body: 'Your 14 changes since opening go. Undo brings them back.',
                action: 'Revert',
                undoable: true,
              }).then((yes) => window.__confirmAnswers.push(yes));
            }}
          >
            Open confirmation
          </Button>
          <Button
            variant="quiet"
            onClick={() => setDocId(docId === 'report' ? 'agreement' : 'report')}
          >
            {`Document: ${docId}`}
          </Button>
        </div>
        {/* The page beneath: white with text and colour, as glass sees a document. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 64,
            left: '50%',
            width: 'min(720px, calc(100% - 32px))',
            height: 1100,
            transform: 'translateX(-50%)',
            padding: 40,
            background: '#fff',
            color: '#111',
            font: '15px/1.5 serif',
          }}
        >
          <h1 style={{ font: '600 28px/1.2 serif', marginBottom: 16 }}>Quarterly report</h1>
          {Array.from({ length: 30 }, (_, i) => (
            <p key={i} style={{ marginBottom: 8 }}>
              {i % 5 === 2 ? (
                <span style={{ background: '#c8fb3d' }}>Highlighted passage {i}. </span>
              ) : null}
              The figures for the quarter show steady growth across every region, with the strongest
              gains in the north and a careful outlook for the months ahead.
            </p>
          ))}
          <div style={{ display: 'flex', height: 60 }}>
            {['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa'].map((c) => (
              <div key={c} style={{ flex: 1, background: c }} />
            ))}
          </div>
        </div>
      </main>
      {(['tool', 'task', 'settings', 'overlay'] as const).map((kind) => (
        <Sheet
          key={kind}
          id={kind}
          kind={kind}
          open={open === kind}
          onClose={close(kind)}
          title={TITLES[kind]}
          description={kind === 'task' ? `${docId}.pdf` : undefined}
          primary={
            kind === 'overlay'
              ? undefined
              : result
                ? { label: 'Done', onPress: () => close(kind)('close') }
                : { label: kind === 'tool' ? 'Apply' : 'Save copy', onPress: () => setResult(true) }
          }
          secondary={
            kind === 'tool' || kind === 'task' ? (
              <Button variant="quiet" icon={<Icon name="arrow-counter-clockwise" />}>
                Reset
              </Button>
            ) : undefined
          }
          footnote={
            kind === 'overlay' ? 'Shortcuts never fire while you type in a field.' : undefined
          }
          testId={`sheet-${kind}`}
        >
          {result ? (
            <SheetResult
              tone="success"
              title="Saved a copy"
              body="report-small.pdf is in your Downloads."
              details={['12 pages', '1.1 MB']}
            />
          ) : (
            <Body kind={kind} docId={docId} />
          )}
        </Sheet>
      ))}
      <ConfirmHost />
    </TooltipProvider>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Gallery />
    </StrictMode>,
  );
}
