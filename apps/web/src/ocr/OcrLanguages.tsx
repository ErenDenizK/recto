/**
 * OCR languages (spec recognize-and-compare §1.1, §1.5; ADR-0012 §3–§4): the packs served
 * from our origin with their size and whether they are on this device, a "Keep available
 * offline" switch per pack, the imported packs with Remove, and "Import language file…".
 *
 * "Keep available offline" is the `pdf-editor-ocr` Cache Storage cache the service worker
 * serves OCR files from (CacheFirst): switching it on downloads the pack (and the engine
 * files this browser needs) into it, switching it off deletes the pack from it. A pack used
 * once is kept there too, so the switch shows what is on the device. Imported files
 * (`.traineddata` or `.traineddata.gz`, never a URL) are checked to be Tesseract language
 * files and kept in the origin-private file system; one named like a served pack overrides it.
 *
 * A page pushed in S10 (`OcrSheet.tsx`): the sheet's ‹ Back returns to the form.
 */
import type { OcrLanguagePack } from '@pdf-editor/engine';
import { useEffect, useState } from 'react';

import { toFailure } from '../engine/engine-service';
import { getLocale, m } from '../i18n';
import { announce } from '../shell/announcer';
import { Button } from '../ui/Button';
import { SheetGroup, SheetRow } from '../ui/sheet/SheetGroup';
import { Switch } from '../ui/Switch';
import styles from './Ocr.module.css';
import { ocrDependencies } from './ocr-deps';
import { formatMegabytes, languageName } from './ocr-model';

type Busy = { readonly code: string; readonly done: number; readonly total: number } | null;

/** A failure of the pack store as a sentence in the UI language. */
function importError(error: unknown): string {
  const failure = toFailure(error);
  if (failure.code === 'corrupt') return m.ocr_import_not_traineddata();
  if (failure.code === 'unsupported' && failure.message.includes('named like')) {
    return m.ocr_import_bad_name();
  }
  return m.ocr_import_failed({ reason: failure.message });
}

export function OcrLanguages() {
  const [packs, setPacks] = useState<readonly OcrLanguagePack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const locale = getLocale();

  // Bumped to read the list again after a change.
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    let live = true;
    ocrDependencies()
      .packs()
      .then((store) => store.list())
      .then(
        (list) => {
          if (live) setPacks(list);
        },
        (failure: unknown) => {
          if (live) setError(m.ocr_packs_failed({ reason: toFailure(failure).message }));
        },
      );
    return () => {
      live = false;
    };
  }, [version]);

  const keepOffline = async (pack: OcrLanguagePack, keep: boolean) => {
    setError(null);
    setBusy({ code: pack.code, done: 0, total: pack.downloadBytes });
    try {
      const deps = ocrDependencies();
      const store = await deps.packs();
      await store.keepOffline([pack.code], keep, keep ? await deps.engineFiles() : [], {
        onProgress: (done, total) => setBusy({ code: pack.code, done, total }),
      });
      announce(
        keep
          ? m.ocr_pack_kept({ name: languageName(pack.code, locale) })
          : m.ocr_pack_removed({ name: languageName(pack.code, locale) }),
      );
    } catch (failure) {
      setError(m.ocr_pack_offline_failed({ reason: toFailure(failure).message }));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const remove = async (pack: OcrLanguagePack) => {
    setError(null);
    try {
      await (await ocrDependencies().packs()).remove(pack.code);
      announce(m.ocr_pack_removed({ name: languageName(pack.code, locale) }));
    } catch (failure) {
      setError(m.ocr_pack_offline_failed({ reason: toFailure(failure).message }));
    } finally {
      refresh();
    }
  };

  const importFile = async () => {
    const file = await pickLanguageFile();
    if (!file) return;
    setError(null);
    try {
      const pack = await (await ocrDependencies().packs()).importFile(file, file.name);
      announce(m.ocr_pack_imported({ name: languageName(pack.code, locale) }));
    } catch (failure) {
      setError(importError(failure));
    } finally {
      refresh();
    }
  };

  return (
    <div className={styles.body} data-testid="ocr-languages">
      <p className={styles.description}>{m.ocr_languages_intro()}</p>
      {packs === null && error === null ? (
        <p className={styles.hint} role="status">
          {m.ocr_languages_loading()}
        </p>
      ) : null}
      <SheetGroup label={m.ocr_languages()} footnote={m.ocr_import_hint()}>
        <ul className={styles.packs} aria-label={m.ocr_languages_title()}>
          {(packs ?? []).map((pack) => {
            const name = languageName(pack.code, locale);
            const working = busy?.code === pack.code;
            const state =
              working && busy
                ? m.ocr_phase_download({
                    count: 1,
                    done: formatMegabytes(busy.done, locale),
                    total: formatMegabytes(busy.total, locale),
                  })
                : pack.source === 'imported'
                  ? m.ocr_pack_imported_state({ size: formatMegabytes(pack.bytes, locale) })
                  : pack.onDevice
                    ? m.ocr_pack_on_device({ size: formatMegabytes(pack.bytes, locale) })
                    : m.ocr_pack_downloads({ size: formatMegabytes(pack.downloadBytes, locale) });
            return (
              <li key={pack.code} className={styles.pack} data-testid="ocr-pack">
                <SheetRow
                  title={
                    <>
                      {name}
                      <span className={styles.code}>{pack.code}</span>
                    </>
                  }
                  description={state}
                >
                  {pack.source === 'imported' ? (
                    <Button
                      size="sm"
                      aria-label={m.ocr_pack_remove_label({ name })}
                      onClick={() => void remove(pack)}
                    >
                      {m.ocr_pack_remove()}
                    </Button>
                  ) : (
                    <Switch
                      hideLabel
                      label={m.ocr_pack_offline_label({ name })}
                      checked={pack.onDevice}
                      disabled={busy !== null}
                      onCheckedChange={(keep) => void keepOffline(pack, keep)}
                    />
                  )}
                </SheetRow>
              </li>
            );
          })}
        </ul>
      </SheetGroup>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.row}>
        <Button onClick={() => void importFile()}>{m.ocr_import()}</Button>
      </div>
    </div>
  );
}

/**
 * Asks for one language file: the file picker with the Tesseract extensions, through an input
 * made for the one pick (a press of "Import language file…" opens it; nothing renders a native
 * file button, quality-bar Q-14).
 */
function pickLanguageFile(): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.traineddata,.gz,application/gzip,application/octet-stream';
    input.hidden = true;
    const finish = (file: File | undefined) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0]), { once: true });
    input.addEventListener('cancel', () => finish(undefined), { once: true });
    document.body.append(input);
    input.click();
  });
}
