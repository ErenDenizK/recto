/**
 * The brand glyph in one ink (DESIGN.md §6; docs/brand/README.md "The mark: files and usage"):
 * the owner's R mark in `currentColor`, for the compact edition and Settings, where it takes
 * its row's ink. The ◆ Library button and the Library header draw `BrandMark` in its `auto` tone
 * (the gradient on dark) instead.
 */
import { BrandMark } from '../brand/BrandMark';

export function AppGlyph({ size = 16 }: { readonly size?: number }) {
  return <BrandMark size={size} tone="mono" />;
}
