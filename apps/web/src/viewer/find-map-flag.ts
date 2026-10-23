/**
 * `?findmap=1` (R26 concept 3; DSN-65): the find map's ticks and phone rail, read once at load
 * because the address is tidied after boot.
 */
export const FIND_MAP = typeof location !== 'undefined' && location.search.includes('findmap=1');
