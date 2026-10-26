/**
 * The Labs panel's words (DSN-82), apart from the registry so the eager flag readers never
 * pull the messages in.
 */
import { m } from '../i18n';
import type { LabsKey } from './flags';

export const LABS_TEXT: Readonly<
  Record<LabsKey, { readonly title: () => string; readonly hint: () => string }>
> = {
  tools: { title: m.labs_tools, hint: m.labs_tools_hint },
  fillbar: { title: m.labs_fillbar, hint: m.labs_fillbar_hint },
  margin: { title: m.labs_margin, hint: m.labs_margin_hint },
  strip: { title: m.labs_strip, hint: m.labs_strip_hint },
  palette: { title: m.labs_palette, hint: m.labs_palette_hint },
  labels: { title: m.labs_labels, hint: m.labs_labels_hint },
  receipt: { title: m.labs_receipt, hint: m.labs_receipt_hint },
  office: { title: m.labs_office, hint: m.labs_office_hint },
  'open-page': { title: m.labs_open_page, hint: m.labs_open_page_hint },
  'open-light': { title: m.labs_open_light, hint: m.labs_open_light_hint },
  'home-search': { title: m.labs_home_search, hint: m.labs_home_search_hint },
  'home-continue': { title: m.labs_home_continue, hint: m.labs_home_continue_hint },
  top: { title: m.labs_top, hint: m.labs_top_hint },
  drawer: { title: m.labs_drawer, hint: m.labs_drawer_hint },
  'phone-capsule': { title: m.labs_phone_capsule, hint: m.labs_phone_capsule_hint },
  textpre: { title: m.labs_textpre, hint: m.labs_textpre_hint },
  scan: { title: m.labs_scan, hint: m.labs_scan_hint },
};

/** The names of a choice flag's values. */
export const LABS_VALUE: Readonly<Record<string, () => string>> = {
  row: m.labs_value_row,
  groups: m.labs_value_groups,
  labels: m.labs_value_labels,
  split: m.labs_value_split,
  capsule: m.labs_value_capsule,
  tiles: m.labs_value_tiles,
  list: m.labs_value_list,
};
