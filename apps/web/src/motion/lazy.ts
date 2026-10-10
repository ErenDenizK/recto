/**
 * Motion that loads at its first use instead of with the editor (docs/plan/v1/PLAN.md §2.3
 * V1-P2, the editor's initial bundle; motion-2026-10). The caller preloads on intent (the tool
 * arming, the surface mounting) so the first use rarely waits; `now()` hands the module over
 * synchronously once it is here, for motion that must start in the same frame as its cause.
 */
export interface LazyModule<T> {
  /** The module if it has loaded, else null (and a load is started). */
  readonly now: () => T | null;
  /** Loads it once; a failed load (offline before the precache filled) may be tried again. */
  readonly load: () => Promise<T>;
  /** Runs `apply` with the module: at once when loaded, else when it arrives (never on failure). */
  readonly run: (apply: (module: T) => void, failed?: () => void) => void;
}

export function lazyModule<T>(importer: () => Promise<T>): LazyModule<T> {
  let loaded: T | null = null;
  let loading: Promise<T> | null = null;
  const load = (): Promise<T> => {
    loading ??= importer().then(
      (module) => {
        loaded = module;
        return module;
      },
      (error: unknown) => {
        loading = null;
        throw error;
      },
    );
    return loading;
  };
  return {
    now: () => {
      if (!loaded) void load().catch(() => undefined);
      return loaded;
    },
    load,
    run: (apply, failed) => {
      if (loaded) apply(loaded);
      else void load().then(apply, () => failed?.());
    },
  };
}
