/**
 * The edition (ADR-0033 §2.1): phones get the compact edition, a read-only reader
 * (`shell/compact/`); everything else gets the full edition at every window size.
 *
 *   edition = matchMedia('(pointer: coarse)').matches
 *             && Math.min(screen.width, screen.height) < 600 ? 'compact' : 'full'
 *
 * - **By device, read once at launch.** The screen's shorter side, not the window's width:
 *   rotation, window resizing and browser zoom never switch the edition (a desktop at 400 %
 *   zoom keeps editing, A-20; a phone turned on its side stays compact).
 * - **`?edition=compact|full`** overrides it for tests and support, and is kept for the
 *   session only (`sessionStorage`), so a reload without the parameter keeps the choice and
 *   a new tab starts from the device again.
 * - **`data-edition`** on `:root` names the edition for CSS.
 *
 * Results: phones in either orientation are compact; an iPad mini (744), 600 px Android
 * tablets, touch laptops (a fine primary pointer) and every desktop window are full.
 */

export type Edition = 'compact' | 'full';

export const EDITION_QUERY_PARAM = 'edition';
/** Session storage key of a `?edition` override (this tab only). */
export const EDITION_SESSION_KEY = 'pdf-editor:edition:v1';
/** A coarse-pointer screen whose shorter side is under this many CSS px is a phone. */
export const COMPACT_MAX_SCREEN_SIDE = 600;

/** A recognised edition name, or undefined. */
export function parseEdition(value: unknown): Edition | undefined {
  return value === 'compact' || value === 'full' ? value : undefined;
}

/** The device rule: a coarse primary pointer on a screen whose shorter side is under 600. */
export function deviceEdition(coarse: boolean, screenWidth: number, screenHeight: number): Edition {
  const side = Math.min(screenWidth, screenHeight);
  return coarse && side > 0 && side < COMPACT_MAX_SCREEN_SIDE ? 'compact' : 'full';
}

/** What the edition is decided from, read from the browser once. */
export interface EditionEnvironment {
  /** `matchMedia('(pointer: coarse)').matches`. */
  readonly coarse: boolean;
  readonly screenWidth: number;
  readonly screenHeight: number;
  /** `location.search`. */
  readonly search: string;
  /** The session's stored override, as read (validated here). */
  readonly stored: unknown;
}

export interface EditionDecision {
  readonly edition: Edition;
  /** The `?edition` override in force (from the address or the session), if any. */
  readonly override?: Edition;
}

/** Pure decision: the address's override, else the session's, else the device rule. */
export function decideEdition(env: EditionEnvironment): EditionDecision {
  const fromQuery = parseEdition(new URLSearchParams(env.search).get(EDITION_QUERY_PARAM));
  const override = fromQuery ?? parseEdition(env.stored);
  if (override !== undefined) return { edition: override, override };
  return { edition: deviceEdition(env.coarse, env.screenWidth, env.screenHeight) };
}

function readStored(storage: Storage | undefined): unknown {
  try {
    return storage?.getItem(EDITION_SESSION_KEY) ?? undefined;
  } catch {
    // Storage disabled (some private windows, sandboxed frames): no override kept.
    return undefined;
  }
}

function writeStored(storage: Storage | undefined, edition: Edition): void {
  try {
    storage?.setItem(EDITION_SESSION_KEY, edition);
  } catch {
    // The override then lasts for this page load only.
  }
}

/** Reads the environment from a window (the real one, or a test's stand-in). */
export function readEditionEnvironment(
  win: Pick<Window, 'matchMedia' | 'screen' | 'location'> & { sessionStorage?: Storage },
): EditionEnvironment {
  let storage: Storage | undefined;
  try {
    storage = win.sessionStorage;
  } catch {
    storage = undefined;
  }
  return {
    coarse: typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches,
    screenWidth: win.screen?.width ?? 0,
    screenHeight: win.screen?.height ?? 0,
    search: win.location?.search ?? '',
    stored: readStored(storage),
  };
}

let launched: Edition | undefined;

/**
 * The edition of this page load: decided on the first call (from `win`, the real window by
 * default) and answered unchanged afterwards, whatever the window does. An override from
 * the address is kept in the session, and `data-edition` is set on `:root`.
 */
export function launchEdition(win: Window = window): Edition {
  if (launched !== undefined) return launched;
  const decision = decideEdition(readEditionEnvironment(win));
  if (decision.override !== undefined) {
    let storage: Storage | undefined;
    try {
      storage = win.sessionStorage;
    } catch {
      storage = undefined;
    }
    writeStored(storage, decision.override);
  }
  launched = decision.edition;
  win.document?.documentElement.setAttribute('data-edition', launched);
  return launched;
}

/** The edition of this page load (decides it on first use). */
export function getEdition(): Edition {
  return launched ?? launchEdition();
}

/** Forgets the launch decision (tests only: a page load decides once). */
export function resetEditionForTests(): void {
  launched = undefined;
}
