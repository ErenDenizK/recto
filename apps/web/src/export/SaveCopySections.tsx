/**
 * The sections of Save a copy (components/07-sheets.md §4.2, §4.4, §4.8): Size with its
 * estimates, the folded rows under PDF (Security, Metadata, Flatten, Signature, each showing
 * its current value), Images and Text. Each section is controlled: the sheet keeps the draft.
 *
 * - **Size** is a radio group whose options carry their estimate ("Smaller, about 1.1 MB");
 *   "Estimating…" while the compress worker analyses (`aria-busy`), "Already compact" under
 *   3 % (§4.4). Custom shows its fields and Print (300 dpi).
 * - **Disclosures** open in place, one at a time; the button's name holds the current value
 *   (§4.8). Security's Password… fields apply to this copy only (S5's fields inline);
 *   Metadata and Signature open the Strip metadata and certificate dialogs nested in the sheet,
 *   until S4 and S8 take them inline (D1).
 */
import { ALL_PERMISSIONS, type VirtualDocument } from '@pdf-editor/document-model';
import {
  MAX_RASTER_DPI,
  MIN_RASTER_DPI,
  type RasterBackground,
  type RasterFormat,
} from '@pdf-editor/engine';
import { ChevronRight, Info, TriangleAlert } from 'lucide-react';
import { type ReactNode, type RefObject, useId } from 'react';

import type { ConvertPageBreak } from '@pdf-editor/engine';
import { metadataOutcome } from '../document/ExportSections';
import { openDocumentDialog } from '../document/document-store';
import { securityOutcome, sourcesOf } from '../document/security-text';
import { formatBytes } from '../files/file-filters';
import { useFormStore } from '../forms/form-store';
import { m } from '../i18n';
import { openSignDialog, setSignOnExport, useSignStore } from '../signatures/sign-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { NumberField } from '../ui/NumberField';
import { RadioGroup, type RadioOption } from '../ui/RadioGroup';
import { Segmented } from '../ui/Segmented';
import { Select } from '../ui/Select';
import { TextField } from '../ui/TextField';
import {
  type CustomSize,
  type Disclosure as DisclosureId,
  type ImagesChoice,
  PRINT_SIZE,
  type SaveCopyDraft,
  type SecurityChoice,
  type SizeChoice,
  type SizeEstimates,
} from './save-copy-model';
import type { SizeAnalysis, TextPreview } from './save-copy-hooks';
import styles from './SaveCopySheet.module.css';

type Patch = (patch: Partial<SaveCopyDraft>) => void;

/** A label · control row (§4.2). The label is the control's visible name, not a `<label>`. */
export function Row({
  label,
  children,
  testId,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <div className={styles.row} data-testid={testId}>
      <span className={styles.rowLabel} aria-hidden="true">
        {label}
      </span>
      <div className={styles.rowBody}>{children}</div>
    </div>
  );
}

/** A warning or info line (§4.4); its glyph and words carry it, never colour alone. */
export function Notice({
  tone,
  children,
  testId,
}: {
  readonly tone: 'info' | 'warning';
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  const Glyph = tone === 'warning' ? TriangleAlert : Info;
  return (
    <div className={styles.notice} data-tone={tone} data-testid={testId} role="note">
      <Glyph aria-hidden="true" className={styles.noticeGlyph} />
      <div className={styles.noticeBody}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Size
// ---------------------------------------------------------------------------

function estimateDetail(
  after: number | null,
  worthwhile: boolean | null,
): {
  detail: string;
  spoken: string;
  description?: string;
} {
  if (after === null) return { detail: m.save_copy_estimating(), spoken: m.save_copy_estimating() };
  const size = formatBytes(after);
  return {
    detail: m.save_copy_estimate({ size }),
    spoken: m.save_copy_estimate_spoken({ size }),
    ...(worthwhile === false ? { description: m.save_copy_compact() } : {}),
  };
}

export function SizeSection({
  draft,
  patch,
  analysis,
  estimates,
  groupRef,
  onWhatSmaller,
}: {
  readonly draft: SaveCopyDraft;
  readonly patch: Patch;
  readonly analysis: SizeAnalysis | null;
  readonly estimates: SizeEstimates | null;
  readonly groupRef: RefObject<HTMLDivElement | null>;
  readonly onWhatSmaller: () => void;
}) {
  const ready = estimates !== null;
  const option = (value: SizeChoice, label: string): RadioOption<SizeChoice> => {
    if (value === 'same') {
      const size = ready ? formatBytes(estimates.same) : null;
      return {
        value,
        label,
        detail: size ?? m.save_copy_estimating(),
        detailLabel: size ?? m.save_copy_estimating(),
      };
    }
    if (value === 'custom' && draft.size !== 'custom') return { value, label };
    const estimate = ready ? estimates[value] : null;
    const shown = estimateDetail(estimate?.after ?? null, estimate?.worthwhile ?? null);
    return {
      value,
      label,
      detail: shown.detail,
      detailLabel: shown.spoken,
      ...(shown.description ? { description: shown.description } : {}),
    };
  };
  const setCustom = (next: Partial<CustomSize>) =>
    patch({ size: 'custom', custom: { ...draft.custom, ...next } });
  return (
    <Row label={m.save_copy_size()} testId="save-copy-size">
      <div ref={groupRef} aria-busy={analysis?.state === 'working' || undefined}>
        <RadioGroup<SizeChoice>
          label={m.save_copy_size()}
          value={draft.size}
          onValueChange={(size) => patch({ size })}
          options={[
            option('same', m.save_copy_size_same()),
            option('smaller', m.save_copy_size_smaller()),
            option('smallest', m.save_copy_size_smallest()),
            option('custom', m.save_copy_size_custom()),
          ]}
        />
      </div>
      {draft.size === 'custom' ? (
        <>
          <div className={styles.pair}>
            <NumberField
              label={m.compress_custom_dpi()}
              showLabel
              min={36}
              max={1200}
              value={draft.custom.dpi}
              disabled={!draft.custom.images}
              onValueChange={(dpi) => {
                if (dpi !== null) setCustom({ dpi });
              }}
            />
            <NumberField
              label={m.compress_custom_quality()}
              showLabel
              min={1}
              max={100}
              value={draft.custom.quality}
              disabled={!draft.custom.images}
              onValueChange={(quality) => {
                if (quality !== null) setCustom({ quality });
              }}
            />
          </div>
          <Checkbox
            label={m.compress_images_toggle()}
            description={m.compress_images_hint()}
            checked={draft.custom.images}
            onCheckedChange={(images) => setCustom({ images })}
          />
          <Checkbox
            label={m.compress_flatten_alpha()}
            checked={draft.custom.flattenAlpha}
            disabled={!draft.custom.images}
            onCheckedChange={(flattenAlpha) => setCustom({ flattenAlpha })}
          />
        </>
      ) : null}
      <div className={styles.links}>
        {draft.size === 'custom' ? (
          <Button variant="quiet" onClick={() => setCustom({ ...PRINT_SIZE, images: true })}>
            {m.save_copy_print()}
          </Button>
        ) : null}
        <Button variant="quiet" onClick={onWhatSmaller} data-testid="save-copy-what-smaller">
          {m.save_copy_what_smaller()}
          <ChevronRight aria-hidden="true" className={styles.chevron} />
        </Button>
      </div>
      {analysis?.state === 'failed' ? (
        <p className={styles.note}>{m.compress_failed({ reason: analysis.message })}</p>
      ) : null}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Disclosures
// ---------------------------------------------------------------------------

function Disclosure({
  id,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  readonly id: DisclosureId;
  readonly label: string;
  readonly value: string;
  readonly open: boolean;
  readonly onToggle: (id: DisclosureId) => void;
  readonly children: ReactNode;
}) {
  const panelId = useId();
  return (
    <div className={styles.disclosure} data-disclosure={id}>
      <button
        type="button"
        className={styles.disclosureButton}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${label}, ${value}`}
        data-focus="inset"
        onClick={() => onToggle(id)}
      >
        <span className={styles.disclosureLabel}>{label}</span>
        <span className={styles.disclosureValue}>{value}</span>
        <ChevronRight aria-hidden="true" className={styles.chevron} />
      </button>
      {open ? (
        <div id={panelId} className={styles.disclosurePanel}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface PasswordFields {
  readonly user: string;
  readonly owner: string;
}

/** The value Security shows folded (§4.5). */
function securityValue(doc: VirtualDocument, choice: SecurityChoice, encrypted: number): string {
  if (choice === 'password') return m.save_copy_security_password_set();
  if (choice === 'none') {
    return doc.security || encrypted > 0
      ? m.save_copy_security_removed()
      : m.save_copy_security_none();
  }
  return doc.security ? m.save_copy_security_document() : m.save_copy_security_none();
}

function flattenValue(annotations: boolean, forms: boolean): string {
  if (annotations && forms) return m.save_copy_flatten_both();
  if (annotations) return m.save_copy_flatten_annotations();
  if (forms) return m.save_copy_flatten_forms();
  return m.save_copy_flatten_nothing();
}

export function PdfDisclosures({
  doc,
  draft,
  patch,
  password,
  onPassword,
  passwordError,
  hasForms,
}: {
  readonly doc: VirtualDocument;
  readonly draft: SaveCopyDraft;
  readonly patch: Patch;
  readonly password: PasswordFields;
  readonly onPassword: (next: PasswordFields) => void;
  readonly passwordError: string | null;
  readonly hasForms: boolean;
}) {
  const encrypted = useWorkspaceStore(
    (s) => sourcesOf(s.workspace, doc).filter((source) => source.flags.encrypted).length,
  );
  const firstFile = useWorkspaceStore((s) => sourcesOf(s.workspace, doc)[0]?.name);
  const flattenForms = useFormStore((s) => s.flattenOnExport);
  const signOn = useSignStore((s) => s.signOnExport[doc.id] === true);
  const signDraft = useSignStore((s) => s.drafts[doc.id]);
  // One disclosure open at a time (§4.6, on compact; everywhere here, so the sheet stays short).
  const toggle = (id: DisclosureId) => patch({ open: draft.open === id ? null : id });

  const policy =
    draft.security === 'document'
      ? doc.security
      : draft.security === 'password'
        ? {
            algorithm: 'aes-256' as const,
            ...(password.user ? { userPassword: password.user } : {}),
            ...(password.owner ? { ownerPassword: password.owner } : {}),
            permissions: doc.security?.permissions ?? ALL_PERMISSIONS,
          }
        : undefined;
  const outcome =
    policy === undefined && (doc.passwordRemoved || draft.security === 'none') && encrypted > 0
      ? m.security_outcome_removed_requested()
      : securityOutcome(policy, encrypted);
  const encryptedOutput = policy !== undefined;
  const signedName = signDraft
    ? (signDraft.signer.commonName ?? signDraft.signer.subject)
    : undefined;

  return (
    <div className={styles.disclosures}>
      <Disclosure
        id="security"
        label={m.save_copy_security()}
        value={securityValue(doc, draft.security, encrypted)}
        open={draft.open === 'security'}
        onToggle={toggle}
      >
        <RadioGroup<SecurityChoice>
          label={m.save_copy_security()}
          value={draft.security}
          onValueChange={(security) => patch({ security })}
          options={[
            ...(doc.security
              ? [{ value: 'document' as const, label: m.save_copy_security_document() }]
              : []),
            {
              value: doc.security ? ('none' as const) : ('document' as const),
              label: m.save_copy_security_none(),
            },
            { value: 'password', label: m.save_copy_security_password() },
          ]}
        />
        {draft.security === 'password' ? (
          <>
            <TextField
              type="password"
              label={m.set_password_user()}
              autoComplete="new-password"
              value={password.user}
              onValueChange={(user) => onPassword({ ...password, user })}
              error={passwordError}
            />
            <TextField
              type="password"
              label={m.set_password_owner()}
              autoComplete="new-password"
              optional
              value={password.owner}
              onValueChange={(owner) => onPassword({ ...password, owner })}
            />
            <p className={styles.note}>{m.save_copy_password_hint()}</p>
          </>
        ) : null}
        <p className={styles.note} data-testid="export-security-outcome">
          {outcome}
        </p>
      </Disclosure>
      <Disclosure
        id="metadata"
        label={m.save_copy_metadata()}
        value={metadataValue(doc)}
        open={draft.open === 'metadata'}
        onToggle={toggle}
      >
        <p className={styles.note} data-testid="export-metadata-outcome">
          {metadataOutcome(doc.metadata, firstFile)}
        </p>
        <div className={styles.links}>
          <Button
            variant="quiet"
            onClick={() => openDocumentDialog('strip-metadata', doc.id, 'export')}
          >
            {m.save_copy_metadata_choose()}
          </Button>
        </div>
      </Disclosure>
      <Disclosure
        id="flatten"
        label={m.save_copy_flatten()}
        value={flattenValue(draft.flattenAnnotations, hasForms && flattenForms)}
        open={draft.open === 'flatten'}
        onToggle={toggle}
      >
        <Checkbox
          label={m.save_copy_flatten_annotations()}
          description={m.export_flatten_annotations_hint()}
          checked={draft.flattenAnnotations}
          onCheckedChange={(flattenAnnotations) => patch({ flattenAnnotations })}
        />
        {hasForms ? (
          <Checkbox
            label={m.save_copy_flatten_forms()}
            checked={flattenForms}
            onCheckedChange={(on) => useFormStore.getState().setFlattenOnExport(on)}
          />
        ) : null}
        <Checkbox
          label={m.save_copy_comments()}
          // Flattened annotations have no comments left to show.
          checked={draft.includeComments && !draft.flattenAnnotations}
          disabled={draft.flattenAnnotations}
          onCheckedChange={(includeComments) => patch({ includeComments })}
        />
        <Checkbox
          label={m.save_copy_compatibility()}
          description={m.export_compatibility_hint()}
          checked={draft.compatibility}
          onCheckedChange={(compatibility) => patch({ compatibility })}
        />
      </Disclosure>
      <Disclosure
        id="signature"
        label={m.save_copy_signature()}
        value={
          signOn && signedName
            ? m.save_copy_signature_on({ name: signedName })
            : m.save_copy_signature_none()
        }
        open={draft.open === 'signature'}
        onToggle={toggle}
      >
        <Checkbox
          label={m.save_copy_signature_sign()}
          description={encryptedOutput ? m.save_copy_signature_encrypted() : m.export_sign_hint()}
          checked={signOn && !encryptedOutput}
          disabled={encryptedOutput}
          onCheckedChange={(on) => {
            setSignOnExport(doc.id, on);
            if (on && !signDraft) openSignDialog(doc.id, 'export');
          }}
        />
        {signOn && !encryptedOutput ? (
          <div className={styles.links} data-testid="export-sign-identity">
            <Button variant="quiet" onClick={() => openSignDialog(doc.id, 'export')}>
              {signDraft ? m.export_sign_change() : m.export_sign_choose()}
            </Button>
          </div>
        ) : null}
      </Disclosure>
    </div>
  );
}

function metadataValue(doc: VirtualDocument): string {
  const meta = doc.metadata;
  if (meta.strip && Object.values(meta.strip).some(Boolean)) return m.save_copy_metadata_removed();
  if (meta.policy === 'explicit') return m.save_copy_metadata_edited();
  return m.save_copy_metadata_kept();
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export function ImagesSection({
  images,
  onImages,
  pageCount,
  pagesValid,
  output,
  draft,
  patch,
  canCopy,
  onCopy,
}: {
  readonly images: ImagesChoice;
  readonly onImages: (next: Partial<ImagesChoice>) => void;
  readonly pageCount: number;
  readonly pagesValid: boolean;
  readonly output: string;
  readonly draft: SaveCopyDraft;
  readonly patch: Patch;
  readonly canCopy: boolean;
  readonly onCopy: () => void;
}) {
  const transparentAllowed = images.type !== 'jpeg';
  return (
    <div className={styles.section} data-testid="save-copy-images">
      <Row label={m.save_copy_images_type()}>
        <Segmented<RasterFormat>
          label={m.save_copy_images_type()}
          value={images.type}
          onValueChange={(type) => onImages({ type })}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPEG' },
            { value: 'webp', label: 'WebP' },
          ]}
        />
      </Row>
      <Row label={m.images_resolution()}>
        <Segmented<ImagesChoice['resolution']>
          label={m.images_resolution()}
          value={images.resolution}
          onValueChange={(resolution) => onImages({ resolution })}
          options={[
            { value: '72', label: '72' },
            { value: '150', label: '150' },
            { value: '300', label: '300' },
            { value: 'custom', label: m.images_dpi_custom() },
          ]}
        />
        {images.resolution === 'custom' ? (
          <NumberField
            label={m.images_custom_dpi()}
            showLabel
            min={MIN_RASTER_DPI}
            max={MAX_RASTER_DPI}
            value={images.customDpi}
            onValueChange={(customDpi) => {
              if (customDpi !== null) onImages({ customDpi });
            }}
          />
        ) : null}
      </Row>
      {images.type !== 'png' ? (
        <Row label={m.images_quality()}>
          <NumberField
            label={m.images_quality()}
            min={1}
            max={100}
            value={images.quality}
            onValueChange={(quality) => {
              if (quality !== null) onImages({ quality: Math.min(100, Math.max(1, quality)) });
            }}
          />
        </Row>
      ) : null}
      {transparentAllowed ? (
        <Row label={m.images_background()}>
          <Segmented<RasterBackground>
            label={m.images_background()}
            value={images.background}
            onValueChange={(background) => onImages({ background })}
            options={[
              { value: 'white', label: m.images_background_white() },
              { value: 'transparent', label: m.images_background_transparent() },
            ]}
          />
        </Row>
      ) : null}
      <Row label={m.images_pages()}>
        <TextField
          label={m.images_pages()}
          hideLabel
          value={images.range}
          placeholder={`1-${pageCount}`}
          description={pagesValid ? m.images_pages_hint() : undefined}
          error={pagesValid ? null : m.images_pages_invalid({ count: pageCount })}
          onValueChange={(range) => onImages({ range })}
        />
        <p className={styles.note} data-testid="images-output">
          {output}
        </p>
        {canCopy ? (
          <div className={styles.links}>
            <Button variant="quiet" onClick={onCopy}>
              {m.save_copy_copy_image()}
            </Button>
          </div>
        ) : null}
      </Row>
      <div className={styles.disclosures}>
        <Disclosure
          id="names"
          label={m.images_names()}
          value={images.template}
          open={draft.open === 'names'}
          onToggle={(id) => patch({ open: draft.open === id ? null : id })}
        >
          <TextField
            label={m.images_names()}
            hideLabel
            value={images.template}
            spellCheck={false}
            description={m.images_names_hint({
              title: '{title}',
              page: '{page}',
              label: '{label}',
            })}
            onValueChange={(template) => onImages({ template })}
          />
        </Disclosure>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const PAGE_BREAKS: readonly { readonly id: ConvertPageBreak; readonly label: () => string }[] = [
  { id: 'none', label: m.convert_break_none },
  { id: 'rule', label: m.convert_break_rule },
  { id: 'comment', label: m.convert_break_comment },
];

export function TextSection({
  draft,
  patch,
  pageCount,
  currentPage,
  pagesValid,
  preview,
  onCopy,
  onRecognize,
}: {
  readonly draft: SaveCopyDraft;
  readonly patch: Patch;
  readonly pageCount: number;
  readonly currentPage: number;
  readonly pagesValid: boolean;
  readonly preview: TextPreview | null;
  readonly onCopy: (text: string) => void;
  readonly onRecognize: () => void;
}) {
  const choice = draft.text;
  const update = (next: Partial<SaveCopyDraft['text']>) => patch({ text: { ...choice, ...next } });
  const markdown = choice.format === 'markdown';
  const result = preview?.state === 'ready' ? preview.result : null;
  const lines = result ? result.text.split('\n') : [];
  const shown = lines.slice(0, 40).join('\n');
  const without = result?.report.pagesWithoutText ?? [];
  const toggle = (id: DisclosureId) => patch({ open: draft.open === id ? null : id });
  return (
    <div className={styles.section} data-testid="save-copy-text">
      <Row label={m.save_copy_text_kind()}>
        <Segmented<SaveCopyDraft['text']['format']>
          label={m.save_copy_text_kind()}
          value={choice.format}
          onValueChange={(format) => update({ format })}
          options={[
            { value: 'markdown', label: m.convert_format_markdown() },
            { value: 'text', label: m.convert_format_text() },
          ]}
        />
      </Row>
      <Row label={m.images_pages()}>
        <Segmented<SaveCopyDraft['text']['scope']>
          label={m.images_pages()}
          value={choice.scope}
          onValueChange={(scope) => update({ scope })}
          options={[
            { value: 'document', label: m.save_copy_pages_all() },
            {
              value: 'page',
              label: m.save_copy_pages_this({ page: Math.min(currentPage, pageCount - 1) + 1 }),
            },
            { value: 'range', label: m.save_copy_pages_range() },
          ]}
        />
        {choice.scope === 'range' ? (
          <TextField
            label={m.convert_scope_range()}
            hideLabel
            value={choice.range}
            placeholder={`1-${pageCount}`}
            error={pagesValid ? null : m.images_pages_invalid({ count: pageCount })}
            description={pagesValid ? m.images_pages_hint() : undefined}
            onValueChange={(range) => update({ range })}
          />
        ) : null}
      </Row>
      {without.length > 0 ? (
        <Notice tone="info" testId="save-copy-no-text">
          <span>{m.save_copy_no_text({ pages: without.map((p) => p + 1).join(', ') })}</span>
          <Button variant="quiet" onClick={onRecognize}>
            {m.save_copy_recognize_first()}
          </Button>
        </Notice>
      ) : null}
      <div className={styles.disclosures}>
        <Disclosure
          id="options"
          label={m.save_copy_text_options()}
          value={
            markdown && choice.images ? m.save_copy_text_with_images() : m.save_copy_text_plain()
          }
          open={draft.open === 'options'}
          onToggle={toggle}
        >
          <Select<ConvertPageBreak>
            block
            label={m.convert_page_breaks()}
            value={choice.pageBreak}
            onValueChange={(pageBreak) => update({ pageBreak })}
            options={PAGE_BREAKS.map((option) => ({ value: option.id, label: option.label() }))}
          />
          <Checkbox
            label={m.convert_join_hyphens()}
            checked={choice.joinHyphens}
            onCheckedChange={(joinHyphens) => update({ joinHyphens })}
          />
          <Checkbox
            label={m.convert_keep_headers()}
            checked={choice.keepHeadersFooters}
            onCheckedChange={(keepHeadersFooters) => update({ keepHeadersFooters })}
          />
          {markdown ? (
            <Checkbox
              label={m.save_copy_text_images()}
              checked={choice.images}
              onCheckedChange={(images) => update({ images })}
            />
          ) : null}
        </Disclosure>
      </div>
      <div className={styles.rowBody}>
        <div className={styles.previewHeader}>
          <span className={styles.rowLabel}>{m.save_copy_preview()}</span>
          {result ? (
            <Button variant="quiet" onClick={() => onCopy(result.text)}>
              {m.save_copy_copy_text()}
            </Button>
          ) : null}
        </div>
        <pre
          className={styles.preview}
          role="region"
          aria-label={m.save_copy_preview()}
          // A scrollable region must be reachable by keyboard (WCAG 2.1.1).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          data-testid="convert-preview"
          data-state={preview?.state ?? 'working'}
        >
          {preview?.state === 'working'
            ? m.convert_progress({
                done: Math.min(preview.done, preview.total),
                total: preview.total,
              })
            : null}
          {preview?.state === 'failed' ? preview.message : null}
          {result ? shown : null}
          {result && lines.length > 40 ? `\n${m.convert_preview_more()}` : ''}
          {result?.text === '' ? m.convert_preview_empty() : ''}
        </pre>
        {result ? (
          <div data-testid="convert-notes">
            <p className={styles.note}>{m.convert_note_order()}</p>
            <p className={styles.note}>
              {result.report.suspectedTables > 0
                ? m.convert_note_tables_found({ count: result.report.suspectedTables })
                : m.convert_note_tables()}
            </p>
            {result.report.dropped.length > 0 && !choice.keepHeadersFooters ? (
              <p className={styles.note}>
                {m.convert_note_dropped({ count: result.report.dropped.length })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
