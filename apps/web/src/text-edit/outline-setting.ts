/**
 * "Show paragraph outlines in Edit text" (TXT-25): on unless the person turned it off, kept in
 * `pdf-editor:paragraph-outlines:v1`. It only matters while the Labs gate
 * (`paragraph-outlines-flag.ts`) is on.
 */
import { create } from 'zustand';

import { readJson, writeJson } from '../state/safe-storage';

export const OUTLINE_SETTING_KEY = 'pdf-editor:paragraph-outlines:v1';

interface OutlineSettingState {
  readonly show: boolean;
  setShow(show: boolean): void;
}

export const useOutlineSetting = create<OutlineSettingState>()((set) => ({
  show: readJson(OUTLINE_SETTING_KEY) !== false,
  setShow: (show) => {
    set({ show });
    writeJson(OUTLINE_SETTING_KEY, show);
  },
}));
