/**
 * The Text view's chunk (PRD-36, EDN-26): what the phone's door (`shell/compact/textview-host.tsx`)
 * loads on intent. The view and its props are here; the data (`session.ts`) is the door's other
 * import, so the two stay apart until the Text view opens.
 */
export type {
  FindMark,
  ImageCrops,
  OcrOffer,
  OcrOfferInfo,
  ReadingPrefs,
  TextViewHostProps,
  TextViewLoader,
  TextViewPlace,
} from './contract';
export { TextView } from './TextView';
