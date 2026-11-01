/**
 * What a phone keeps while it scans (EDN-23; plan bm-scan-plan §2 "Memory on iPhone"). Safari
 * limits one canvas to 16.7 Mpx and all canvases to about 224 to 384 MB, and a phone keeps one
 * unsaved document in memory besides. A page costs its source JPEG (1 to 2 MB at 4K), its
 * preview (about 0.3 MB) and two object URLs, so 40 pages stay near 80 MB.
 */

/** Long side of a finished page, px (plan §2: 3,000 px on larger screens, 2,400 on phones). */
export const PHONE_PAGE_SIDE = 2400;

/** The most pages one scan keeps (plan §2: "phones suggest finishing at 40"). */
export const PHONE_MAX_PAGES = 40;

/**
 * The longest side a photo from the camera app is kept at, px: a 48 Mpx photo would otherwise
 * stay whole in the page and be decoded whole again for every preview and for Done. A live
 * capture is already at most the camera stream's width (4K).
 */
export const PHONE_PHOTO_SIDE = 4000;

export const PHONE_LIMITS = {
  maxPages: PHONE_MAX_PAGES,
  photoSide: PHONE_PHOTO_SIDE,
} as const;
