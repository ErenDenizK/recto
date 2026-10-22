/**
 * The host of a sheet that loads on first use (PF-21, quality-bar Q-11): it mounts the lazy
 * sheet when `useOpen` first reports an opening and keeps it mounted so the sheet can animate
 * out. When the chunk fails to load (offline before the precache filled, a stale deploy), the
 * failure toast offers a reload, `cancel` closes the request cleanly (a pending question
 * resolves as cancelled), and the next opening imports the chunk again, as `loadOverview` does
 * (`shell/compact/overview-host.tsx`).
 */
import {
  Component,
  type ComponentType,
  type ErrorInfo,
  lazy,
  type ReactNode,
  Suspense,
  useState,
} from 'react';

import { m } from '../i18n';
import { toast } from './Toast';

class LoadBoundary extends Component<
  { readonly onFail: () => void; readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onFail();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function createSheetHost(
  load: () => Promise<{ default: ComponentType }>,
  useOpen: () => boolean,
  cancel: () => void,
): () => ReactNode {
  // A rejected `lazy` stays rejected, so a failure makes a fresh one for the next opening.
  let Sheet = lazy(load);
  return function SheetHost() {
    const open = useOpen();
    const [asked, setAsked] = useState(open);
    if (open && !asked) setAsked(true);
    if (!asked) return null;
    const fail = () => {
      Sheet = lazy(load);
      toast.failure(m.error_load_failed(), {
        action: { label: m.error_reload(), run: () => location.reload() },
        key: 'sheet-load-failed',
      });
      cancel();
      setAsked(false);
    };
    return (
      <LoadBoundary onFail={fail}>
        <Suspense fallback={null}>
          <Sheet />
        </Suspense>
      </LoadBoundary>
    );
  };
}
