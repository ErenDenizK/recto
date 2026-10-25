/**
 * Mounts the scan sheet (plan bm-scan-plan §3): the first call loads this chunk, creates the
 * sheet's own React root beside the app's and opens the sheet; later calls only open it. The sheet
 * lives in its own root so the Library button and the command (the only callers, both outside the
 * shell tree's reach) need no host in `AppShell`. Its state is the module-level store, so the
 * rest of the app is unaffected.
 */
import { createRoot, type Root } from 'react-dom/client';

import { TooltipProvider } from '../ui/Tooltip';
import { openScanSheet } from './scan-store';
import { ScanSheet } from './ScanSheet';

let root: Root | null = null;

export function mountScan(): void {
  if (!root) {
    const container = document.createElement('div');
    container.dataset.scanRoot = '';
    document.body.append(container);
    root = createRoot(container);
    root.render(
      <TooltipProvider>
        <ScanSheet />
      </TooltipProvider>,
    );
  }
  openScanSheet();
}
