/**
 * S2, Save a copy (components/07-sheets.md §4; ADR-0032 §2 item 3; flows §5.1; spec redesign
 * D0-9): one task sheet for every output that is not Save in place. It absorbs the Export
 * dialog, Compress, Export as images and Export as Markdown or text.
 *
 * - **Format** PDF · Images · Text. Under PDF: **Size** with an estimate beside each preset
 *   (INV-18), then Security, Metadata, Flatten and Signature folded under their current
 *   value, then the name. Images and Text carry their own choices; Text previews the first 40
 *   lines and saves exactly what it previewed.
 * - **The primary** (§4.6): Save copy opens the picker first, inside the press; Download copy
 *   where there is no picker; Share copy on a coarse pointer that can share files, with the
 *   copy pre-assembled 600 ms after the settings settle ("Preparing… 40 %" until then).
 * - **Working** (§4.4): the sheet closes and the job shows in the toast stack
 *   (`save-copy-run.ts`); the toast says where the copy went, Details shows its summary.
 * - **Drafts**: what was chosen stays per document for the session (07 §1.1 rule 5); the
 *   passwords typed for this copy do not (they live in the sheet while it is open).
 * - **Guard:** none, output only (07 §1.1 rule 4): a locked document saves a copy.
 *
 * Loaded on first use (`SaveCopyHost.tsx`, quality-bar Q-11).
 */
import { ALL_PERMISSIONS, type DocumentId } from '@pdf-editor/document-model';
import {
  estimateCompression,
  parsePageRange,
  presetSettings,
  RASTER_MIME,
  rasterFileName,
  rasterSize,
} from '@pdf-editor/engine/client';
import { type RefObject, useEffect, useRef, useState } from 'react';

import { choicePages } from '../convert/convert-run';
import { toPolicy, validatePasswordForm } from '../document/password-form';
import { useFormStore } from '../forms/form-store';
import { getLocale, m } from '../i18n';
import { openOcrDialog } from '../ocr/ocr-store';
import { applyMarks, countMarks, pendingMarksOf } from '../files/save';
import { displaySize } from '../pages/page-geometry';
import { announce } from '../shell/announcer';
import { activeSignDraft, openSignDialog, useSignStore } from '../signatures/sign-store';
import { useSignedSources } from '../signatures/use-signatures';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { canCopyImage, copyImage } from '../tools/deliver-file';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { Sheet, useSheetDraft } from '../ui/sheet';
import { TextField } from '../ui/TextField';
import {
  closeSaveCopy,
  isSaveCopyPreset,
  SAVE_COPY_SHEET,
  type SaveCopyPreset,
  useSaveCopyResults,
} from './export-store';
import { exportFileName } from './filename';
import { CopyDetails, WhatGetsSmaller } from './SaveCopyPages';
import {
  Group,
  ImagesSection,
  Notice,
  PdfDisclosures,
  SizeSection,
  TextSection,
} from './SaveCopySections';
import styles from './SaveCopySheet.module.css';
import {
  usePendingMarks,
  usePlatform,
  usePrepared,
  useSizeAnalysis,
  useTextPreview,
} from './save-copy-hooks';
import {
  applyPreset,
  buildKey,
  copyName,
  DEFAULT_DRAFT,
  defaultName,
  imagesDpi,
  imagesName,
  percentOf,
  primaryKind,
  type SaveCopyDraft,
  type SaveCopyFormat,
  sizeEstimates,
  sizeSettings,
  stemOf,
} from './save-copy-model';
import {
  buildCopy,
  type CopyRequest,
  copySubtitle,
  pickTarget,
  requestFile,
  runSaveCopy,
  shareCopy,
  showCopyDone,
  showCopyFailed,
} from './save-copy-run';

type Page = 'form' | 'smaller' | 'details';

export interface SaveCopySheetProps {
  readonly documentId: DocumentId;
  readonly open: boolean;
  /** The opener's preset, read each time the sheet opens. */
  readonly preset: string | null;
  /** Changes on every open (the store's open request), so the preset applies once per open. */
  readonly opening: object | null;
}

export default function SaveCopySheet({ documentId, open, preset, opening }: SaveCopySheetProps) {
  const doc = useWorkspaceStore((s) => s.workspace.documents[documentId]);
  const ws = useWorkspaceStore((s) => s.workspace);
  const currentPage = useViewStore((s) => s.currentPage);
  const [draft, setDraft, , restored] = useSheetDraft<SaveCopyDraft>(
    SAVE_COPY_SHEET,
    documentId,
    DEFAULT_DRAFT,
  );
  const patch = (next: Partial<SaveCopyDraft>) => setDraft((d) => ({ ...d, ...next }));
  const [page, setPage] = useState<Page>('form');
  const [password, setPassword] = useState({ user: '', owner: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const sizeRef = useRef<HTMLDivElement | null>(null);
  const formatRef = useRef<HTMLDivElement | null>(null);
  const platform = usePlatform();
  const kind = primaryKind(platform);
  const locale = getLocale();
  const summary = useSaveCopyResults((s) => s.results[documentId]);
  const flattenForms = useFormStore((s) => s.flattenOnExport);
  const signOn = useSignStore((s) => s.signOnExport[documentId] === true);
  const signed = useSignedSources(documentId).length > 0;

  // Each open applies its opener's preset (Compress… → Size: Smaller) and starts on its page.
  const [applied, setApplied] = useState<object | null>(null);
  if (open && opening !== applied) {
    setApplied(opening);
    setAsking(false);
    const known: SaveCopyPreset | null = isSaveCopyPreset(preset) ? preset : null;
    setPage(known === 'details' ? 'details' : 'form');
    if (known !== null && known !== 'details') setDraft((d) => applyPreset(d, known));
  }
  // The passwords live only while the sheet is open.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setPassword({ user: '', owner: '' });
      setPasswordError(null);
    }
  }
  // Closed, the sheet holds what it last showed while it animates out (Q-7: content never
  // changes while it moves): the estimates, the preview and the marks stay, nothing new runs.
  const held = !open;

  const pageCount = doc?.pages.length ?? 0;
  const title = doc?.title ?? m.export_default_name();
  const hasForms =
    (doc?.fields?.length ?? 0) > 0 ||
    (doc?.pages ?? []).some(
      (p) => p.ref.kind === 'source' && ws.sources[p.ref.source]?.flags.hasAcroForm,
    );
  const repaired = (doc?.pages ?? []).some(
    (p) => p.ref.kind === 'source' && ws.sources[p.ref.source]?.flags.repaired,
  );

  // PDF: unapplied redaction marks, asked about at the press (07.10). They are read
  // asynchronously (the edit runner settles, unread pages are listed); until they are known the
  // primary waits, busy, so a quick press never saves a copy that keeps the text under them. The
  // press cannot wait for them instead: the picker must open inside it.
  const marks = usePendingMarks(
    documentId,
    open && draft.format === 'pdf',
    held && draft.format === 'pdf',
  );
  const marksUnknown = draft.format === 'pdf' && marks === null;

  // PDF: the analysis behind the estimates.
  const analysis = useSizeAnalysis(
    documentId,
    open && draft.format === 'pdf',
    held && draft.format === 'pdf',
  );
  const estimates =
    analysis?.state === 'ready'
      ? sizeEstimates(analysis.analysis, draft.custom, presetSettings, estimateCompression)
      : null;
  const compression = sizeSettings(draft.size, draft.custom, presetSettings);

  // Images.
  const imagePages = parsePageRange(draft.images.range, pageCount);
  const imagesValid = imagePages !== null && imagePages.length > 0;
  const dpi = imagesDpi(draft.images);
  const firstImagePage = imagePages?.[0] !== undefined ? doc?.pages[imagePages[0]] : undefined;
  const firstSize = firstImagePage
    ? (() => {
        const shown = displaySize(ws, firstImagePage);
        return rasterSize(shown.width, shown.height, dpi);
      })()
    : null;
  const imagesOutput = !imagesValid
    ? ''
    : imagePages.length === 1 && firstSize
      ? m.images_output_single({ width: firstSize.width, height: firstSize.height })
      : m.images_output_zip({ count: imagePages.length });

  // Text.
  const textPages = choicePages(draft.text, pageCount, currentPage, parsePageRange);
  const preview = useTextPreview(
    documentId,
    open && draft.format === 'text',
    draft.text,
    textPages,
    held && draft.format === 'text',
  );

  const name = copyName(draft, title, locale);

  /** The copy as asked now, or a reason it cannot be made. */
  const request = (): CopyRequest | { readonly invalid: string } => {
    if (pageCount === 0) return { invalid: m.export_error_no_pages() };
    if (draft.format === 'images') {
      if (!imagesValid) return { invalid: m.images_pages_invalid({ count: pageCount }) };
      const zip = imagePages.length > 1;
      return {
        format: 'images',
        name: imagesName(draft.images, title, imagePages, pageCount, rasterFileName),
        type: zip ? 'application/zip' : RASTER_MIME[draft.images.type],
        options: {
          format: draft.images.type,
          dpi,
          quality: draft.images.quality,
          background: draft.images.type === 'jpeg' ? 'white' : draft.images.background,
          pages: imagePages,
          template: draft.images.template,
        },
      };
    }
    if (draft.format === 'text') {
      if (textPages === null) return { invalid: m.images_pages_invalid({ count: pageCount }) };
      return {
        format: 'text',
        stem: stemOf(name),
        pages: textPages,
        choice: draft.text,
        ready: preview?.state === 'ready' ? preview.result : undefined,
      };
    }
    let security: PdfSecurity;
    if (draft.security === 'password') {
      const values = {
        userPassword: password.user,
        ownerPassword: password.owner,
        permissions: doc?.security?.permissions ?? ALL_PERMISSIONS,
      };
      const problem = validatePasswordForm(values).problem;
      if (problem) {
        return {
          invalid:
            problem === 'no-password'
              ? m.set_password_error_none()
              : problem === 'same-passwords'
                ? m.set_password_error_same()
                : m.set_password_error_long(),
        };
      }
      security = toPolicy(values);
    } else {
      security = draft.security === 'none' ? null : undefined;
    }
    const sign = activeSignDraft(documentId);
    const sizeLabel = {
      same: undefined,
      smaller: m.save_copy_size_smaller(),
      smallest: m.save_copy_size_smallest(),
      custom: m.compress_preset_custom(),
    }[draft.size];
    return {
      format: 'pdf',
      name,
      sizeLabel,
      options: {
        compatibility: draft.compatibility,
        flattenAnnotations: draft.flattenAnnotations,
        flattenForms: hasForms && flattenForms,
        includeComments: draft.includeComments,
        compression,
        ...(security === undefined ? {} : { security }),
        // The sheet's certificate is cleared when it closes; the copy keeps its own bytes.
        ...(sign && security == null ? { sign: { ...sign, pkcs12: sign.pkcs12.slice(0) } } : {}),
      },
    };
  };

  // Share: the copy pre-assembled once the settings rest (§27.6).
  const sharing = kind === 'share' && open && page !== 'details';
  const shareRequest = sharing ? request() : null;
  const shareKey = buildKey(documentId, draft, [password, signOn, flattenForms, ws]);
  const prepared = usePrepared(
    sharing && shareRequest !== null && !('invalid' in shareRequest),
    shareKey,
    (signal, onProgress) => {
      const asked = request();
      if ('invalid' in asked) return Promise.reject(new Error(asked.invalid));
      return buildCopy(documentId, asked, { signal, onProgress });
    },
    held && kind === 'share' && page !== 'details',
  );

  /** The press, and the answer to the unapplied-marks question when it was asked (07.10). */
  const press = (marksAnswer: 'apply' | 'without' | null = null) => {
    const asked = request();
    if ('invalid' in asked) {
      if (draft.format === 'pdf' && draft.security === 'password') {
        setPasswordError(asked.invalid);
        patch({ open: 'security' });
      }
      announce(asked.invalid, { politeness: 'assertive' });
      return;
    }
    if (asked.format === 'pdf' && signOn && !activeSignDraft(documentId)) {
      // Signing without a certificate yet: choose one first.
      openSignDialog(documentId, 'export');
      return;
    }
    // Marks left unapplied leak the text under them: ask first, as Save does (07.10). Not
    // known yet: the primary is busy, and Enter waits with it.
    if (asked.format === 'pdf' && marks === null) return;
    const pending = asked.format === 'pdf' && marks !== null && marks.count > 0 ? marks : null;
    if (pending && marksAnswer === null) {
      setAsking(true);
      announce(m.save_marks_title({ count: pending.count }), { politeness: 'assertive' });
      return;
    }
    setAsking(false);
    const before =
      pending && marksAnswer === 'apply'
        ? async () => {
            // Read again at the work: the marks are what the document holds now.
            const now = useWorkspaceStore.getState().workspace;
            const shown = now.documents[documentId];
            const fresh = shown ? await pendingMarksOf(now, shown) : pending.marks;
            if (countMarks(fresh) === 0) return null;
            return (await applyMarks(fresh)) === undefined ? m.save_reason_marks() : null;
          }
        : undefined;
    if (kind === 'share' && before) {
      // The prepared copy still has the marks: apply them, and the copy is prepared again.
      void before().then((refused) => {
        if (refused !== null) showCopyFailed(documentId, refused);
      });
      return;
    }
    if (kind === 'share') {
      if (prepared?.state !== 'ready') {
        announce(
          m.save_copy_preparing({
            percent: percentOf(prepared?.state === 'working' ? prepared.share : 0),
          }),
        );
        return;
      }
      const output = prepared.output;
      // Web Share is called inside the press (it needs the press's activation).
      shareCopy(output).then(
        (shared) => {
          if (!shared) return;
          closeSaveCopy();
          showCopyDone(documentId, output.summary, 'shared');
        },
        (error: unknown) =>
          showCopyFailed(documentId, error instanceof Error ? error.message : String(error)),
      );
      return;
    }
    // The picker first, inside the press; the work follows as a job.
    pickTarget(requestFile(asked)).then(
      (target) => {
        if (target === 'cancelled') return;
        closeSaveCopy();
        void runSaveCopy(documentId, asked, target, before);
      },
      (error: unknown) =>
        showCopyFailed(documentId, error instanceof Error ? error.message : String(error)),
    );
  };

  const copyPageImage = () => {
    const asked = request();
    if ('invalid' in asked || asked.format !== 'images' || asked.options.pages.length !== 1) return;
    // The clipboard item is created synchronously in the press, with a promise of the PNG.
    const png = buildCopy(documentId, {
      ...asked,
      type: 'image/png',
      options: { ...asked.options, format: 'png' },
    }).then((output) => output.blob);
    copyImage(png).then(
      () => announce(m.announce_image_copied()),
      (error: unknown) =>
        showCopyFailed(documentId, error instanceof Error ? error.message : String(error)),
    );
  };

  // Read closed too, so the primary holds its state while the sheet animates out.
  const asked = request();
  const invalid = 'invalid' in asked ? asked.invalid : undefined;
  const primaryLabel =
    kind === 'share'
      ? prepared?.state === 'ready'
        ? m.save_copy_share()
        : m.save_copy_preparing({
            percent: percentOf(prepared?.state === 'working' ? prepared.share : 0),
          })
      : kind === 'save'
        ? m.save_copy_save()
        : m.save_copy_download();
  // Compress… puts focus on Size (§4.1); other openers on the chosen format (§2.6).
  const checked = '[role="radio"][aria-checked="true"]';
  const sizeFocus: RefObject<HTMLElement | null> = {
    get current() {
      return sizeRef.current?.querySelector<HTMLElement>(checked) ?? null;
    },
  };
  const formatFocus: RefObject<HTMLElement | null> = {
    get current() {
      return formatRef.current?.querySelector<HTMLElement>(checked) ?? null;
    },
  };

  return (
    <Sheet
      id={SAVE_COPY_SHEET}
      kind="task"
      open={open && doc !== undefined}
      onClose={() => closeSaveCopy()}
      title={page === 'smaller' ? m.save_copy_what_smaller() : m.save_copy_title()}
      subtitle={copySubtitle(
        exportFileName(title),
        pageCount,
        analysis?.state === 'ready' ? analysis.analysis.totalBytes : null,
      )}
      restored={restored}
      back={page === 'form' ? undefined : () => setPage('form')}
      cancel={false}
      initialFocus={preset === 'size' ? sizeFocus : formatFocus}
      secondary={<span className={styles.footnote}>{m.save_copy_footer()}</span>}
      primary={
        page === 'details'
          ? { label: m.sheet_done(), onPress: () => closeSaveCopy() }
          : {
              label: primaryLabel,
              onPress: () => press(),
              disabled:
                invalid !== undefined && !(draft.security === 'password' && draft.format === 'pdf'),
              reason: invalid,
              busy: marksUnknown,
              busyLabel: m.save_copy_checking_marks(),
            }
      }
      testId="save-copy-sheet"
    >
      {page === 'details' && summary ? <CopyDetails summary={summary} /> : null}
      {page === 'smaller' ? (
        <WhatGetsSmaller
          analysis={analysis?.state === 'ready' ? analysis.analysis : null}
          source={analysis?.state === 'ready' ? analysis.source : null}
          settings={compression ?? presetSettings('ebook')}
          sizeLabel={
            {
              same: m.save_copy_size_smaller(),
              smaller: m.save_copy_size_smaller(),
              smallest: m.save_copy_size_smallest(),
              custom: m.compress_preset_custom(),
            }[draft.size]
          }
        />
      ) : null}
      {page === 'form' && doc ? (
        <div className={styles.form} data-testid="save-copy-form">
          <Group label={m.save_copy_format()}>
            <div ref={formatRef}>
              <Segmented<SaveCopyFormat>
                label={m.save_copy_format()}
                value={draft.format}
                onValueChange={(format) => patch({ format, open: null })}
                options={[
                  { value: 'pdf', label: m.save_copy_format_pdf() },
                  { value: 'images', label: m.save_copy_format_images() },
                  { value: 'text', label: m.save_copy_format_text() },
                ]}
              />
            </div>
          </Group>
          {draft.format === 'pdf' ? (
            <div className={styles.section} key="pdf" data-testid="save-copy-pdf">
              <SizeSection
                draft={draft}
                patch={patch}
                analysis={analysis}
                estimates={estimates}
                groupRef={sizeRef}
                onWhatSmaller={() => setPage('smaller')}
              />
              <PdfDisclosures
                doc={doc}
                draft={draft}
                patch={patch}
                password={password}
                onPassword={(next) => {
                  setPassword(next);
                  setPasswordError(null);
                }}
                passwordError={passwordError}
                hasForms={hasForms}
              />
              {signed && !signOn ? (
                <Notice tone="warning" testId="export-signatures-notice">
                  {m.save_copy_signed_warning()}
                </Notice>
              ) : null}
              {repaired ? <Notice tone="info">{m.save_copy_repaired_info()}</Notice> : null}
              {asking && marks !== null && marks.count > 0 ? (
                <MarksQuestion count={marks.count} onAnswer={press} />
              ) : null}
              <NameField draft={draft} patch={patch} title={title} locale={locale} />
            </div>
          ) : null}
          {draft.format === 'images' ? (
            <ImagesSection
              key="images"
              images={draft.images}
              onImages={(next) => patch({ images: { ...draft.images, ...next } })}
              pageCount={pageCount}
              pagesValid={imagesValid}
              output={imagesOutput}
              draft={draft}
              patch={patch}
              canCopy={imagesValid && imagePages.length === 1 && canCopyImage()}
              onCopy={copyPageImage}
            />
          ) : null}
          {draft.format === 'text' ? (
            <>
              <TextSection
                key="text"
                draft={draft}
                patch={patch}
                pageCount={pageCount}
                currentPage={currentPage}
                pagesValid={textPages !== null}
                preview={preview}
                onCopy={(text) => {
                  void navigator.clipboard
                    ?.writeText(text)
                    .then(() => announce(m.save_copy_text_copied()));
                }}
                onRecognize={() => {
                  closeSaveCopy();
                  openOcrDialog(documentId);
                }}
              />
              <NameField
                draft={draft}
                patch={patch}
                title={title}
                locale={locale}
                zip={preview?.state === 'ready' && preview.result.zip !== undefined}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

type PdfSecurity = Extract<CopyRequest, { format: 'pdf' }>['options']['security'];

function NameField({
  draft,
  patch,
  title,
  locale,
  zip = false,
}: {
  readonly draft: SaveCopyDraft;
  readonly patch: (next: Partial<SaveCopyDraft>) => void;
  readonly title: string;
  readonly locale: string;
  /** A Markdown copy with images is a ZIP of the same stem. */
  readonly zip?: boolean;
}) {
  const fallback = defaultName(draft, title, locale);
  const shown = draft.name ?? (zip ? `${stemOf(fallback)}.zip` : fallback);
  return (
    <Group label={m.save_copy_name()}>
      <TextField
        label={m.save_copy_name()}
        hideLabel
        value={shown}
        spellCheck={false}
        autoComplete="off"
        onValueChange={(name) => patch({ name })}
        onBlur={() => {
          if (draft.name !== null && draft.name.trim() === '') patch({ name: null });
        }}
      />
    </Group>
  );
}

/**
 * The unapplied-marks question in the sheet (spec 07.10, the words of Save's): Apply and save
 * is the default and takes focus; Save without applying goes on with the honesty line said.
 * Either press carries the activation the save picker needs.
 */
function MarksQuestion({
  count,
  onAnswer,
}: {
  readonly count: number;
  readonly onAnswer: (answer: 'apply' | 'without') => void;
}) {
  const apply = useRef<HTMLButtonElement>(null);
  useEffect(() => apply.current?.focus(), []);
  return (
    <Notice tone="warning" testId="save-copy-marks">
      <strong>{m.save_marks_title({ count })}</strong>
      <span>{m.save_marks_body({ count })}</span>
      <div className={styles.links}>
        <Button variant="quiet" onClick={() => onAnswer('without')}>
          {m.save_marks_without()}
        </Button>
        <Button ref={apply} variant="standard" onClick={() => onAnswer('apply')}>
          {m.save_marks_apply()}
        </Button>
      </div>
    </Notice>
  );
}
