/**
 * The toast system (`08-feedback` FB4, FB5; spec redesign X14, D0-5): `toast` to show one,
 * `ToastRegion` once per edition, the store for tests and owners that watch it.
 */
export { ProgressCapsule } from './ProgressCapsule';
export { hasToast, setHistoryOpener, type ToastOptions, toast } from './toast';
export {
  type DismissReason,
  dismissToast,
  resetToasts,
  type Toast,
  type ToastAction,
  type ToastKind,
  useToastStore,
} from './toast-store';
export { ToastRegion, type ToastRegionProps } from './ToastRegion';
