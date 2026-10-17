/** Localized labels for compression presets and skip reasons. */
import type { CompressionPresetId, ImageSkipReason } from '@pdf-editor/engine';

import { m } from '../i18n';

export function presetName(preset: CompressionPresetId): string {
  switch (preset) {
    case 'screen':
      return m.compress_preset_screen();
    case 'ebook':
      return m.compress_preset_ebook();
    case 'print':
      return m.compress_preset_print();
    case 'custom':
      return m.compress_preset_custom();
  }
}

export function skipReason(reason: ImageSkipReason): string {
  switch (reason) {
    case 'filter-unsupported':
      return m.compress_skip_filter_unsupported();
    case 'image-mask':
      return m.compress_skip_image_mask();
    case 'bilevel':
      return m.compress_skip_bilevel();
    case 'has-alpha':
      return m.compress_skip_has_alpha();
    case 'has-mask':
      return m.compress_skip_has_mask();
    case 'at-target':
      return m.compress_skip_at_target();
    case 'too-small':
      return m.compress_skip_too_small();
    case 'too-large':
      return m.compress_skip_too_large();
    case 'not-smaller':
      return m.compress_skip_not_smaller();
    case 'decode-failed':
      return m.compress_skip_decode_failed();
    case 'not-placed':
      return m.compress_skip_not_placed();
  }
}
