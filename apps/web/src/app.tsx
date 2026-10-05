import { useLayoutEffect } from 'react';

import { registerPenBar } from './annotations/pen/PenBar.register';
import { registerAppCommands } from './commands/app-commands';
import { commandRegistry } from './commands/registry';
import { registerDocumentCommands } from './document/document-commands';
import { DocumentDialogs } from './document/DocumentDialogs';
import { getEngineService } from './engine/engine-service';
import { ExportDialog } from './export/ExportDialog';
import { useLocale } from './i18n';
import { LocaleBoundary } from './i18n/LocaleBoundary';
import { watchOcrJob } from './ocr';
import { registerOutlineCommands } from './outline/outline-commands';
import { AppShell } from './shell/AppShell';
import { registerArrangeCommands } from './stage/arrange-commands';
import { OperationDialogs } from './stage/OperationDialogs';
import { startSession } from './session/session';
import { watchSessionNotice } from './session/session-toast';
import { registerSignatureCommands } from './signatures/signature-commands';
import { startSignatureValidation } from './signatures/signature-store';
import { SignDialog } from './signatures/SignDialog';
import { requestPassword } from './state/password-store';

/**
 * Application root. Registers the shell's commands before first paint (so keycap hints
 * render immediately), connects the engine's password prompt, and mounts the shell.
 * A language switch re-registers the commands (their titles are translated) and remounts
 * the shell through `LocaleBoundary`.
 */
export function App() {
  const locale = useLocale();
  useLayoutEffect(() => registerAppCommands(), [locale]);
  useLayoutEffect(() => registerArrangeCommands(), [locale]);
  useLayoutEffect(() => registerDocumentCommands(commandRegistry), [locale]);
  useLayoutEffect(() => registerOutlineCommands(commandRegistry), [locale]);
  useLayoutEffect(() => registerSignatureCommands(commandRegistry), [locale]);
  // The pen presets in the tool bar's Draw group (experience-redesign spec §6.2).
  useLayoutEffect(() => registerPenBar(), []);
  // Signature validation on open (spec recognize-and-compare §3.1).
  useLayoutEffect(() => startSignatureValidation(), []);
  // Snapshots on this device and restore on launch (ADR-0032 §2.4, §2.5).
  useLayoutEffect(() => startSession({ edition: 'full' }), []);
  // Its notice ("Restored 3 documents · Start fresh") is a toast (D0-5).
  useLayoutEffect(() => watchSessionNotice(), []);
  // A running OCR shows in the progress capsule while its dialog is closed (FB5).
  useLayoutEffect(() => watchOcrJob(), []);
  useLayoutEffect(() => {
    const engine = getEngineService();
    engine.setPasswordPrompt(requestPassword);
    return () => engine.setPasswordPrompt(undefined);
  }, []);
  return (
    <LocaleBoundary>
      <AppShell />
      <ExportDialog />
      <DocumentDialogs />
      <SignDialog />
      <OperationDialogs />
    </LocaleBoundary>
  );
}
