/**
 * The version number as the Labs reveal's tap target (DSN-82): five quick taps show the panel
 * (`store.ts`). Plain text to everyone else: no role, no focus ring, nothing announced.
 */
import { type ReactNode, useState } from "react";

import { createRevealTap } from "./store";

export function RevealTap({ children }: { readonly children: ReactNode }) {
  const [tap] = useState(() => createRevealTap());
  // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- a hidden gesture; the panel itself is the keyboard path once shown
  return <span onClick={tap}>{children}</span>;
}
