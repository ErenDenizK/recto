/**
 * The page overview's lazy chunk (MOB-2): loaded by `../overview-host.tsx` when the browser is
 * idle after the reader opens, or at once when Pages is tapped.
 */
export { CompactOverview } from './CompactOverview';
export {
  beginPinchMorph,
  closeOverview,
  morphBusy,
  openOverview,
  type PinchMorph,
  showChip,
} from './morph';
