/** One icon per annotation kind, so colour is never the only cue (spec §9). */
import type { Annotation } from '@pdf-editor/engine';

import type { IconName } from '../ui/Icon';
import { displayKind } from './geometry';

export function annotationIcon(a: Annotation): IconName {
  switch (displayKind(a)) {
    case 'highlight':
      return 'highlighter';
    case 'underline':
      return 'text-underline';
    case 'strikeout':
      return 'text-strikethrough';
    case 'squiggly':
      return 'wave-sine';
    case 'ink':
      return 'pen';
    case 'square':
      return 'square';
    case 'circle':
      return 'circle';
    case 'line':
      return 'line-segment';
    case 'arrow':
      return 'arrow-up-right';
    case 'polygon':
      return 'polygon';
    case 'polyline':
      return 'line-segments';
    case 'free-text':
      return 'textbox';
    case 'text':
      return 'note';
    case 'stamp':
    case 'signature':
      return 'stamp';
    case 'link':
      return 'link';
    case 'redact':
      return 'redact';
  }
}
