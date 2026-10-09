/**
 * The platform port (docs/plan/v1/editions.md §4.1, §5.1; PLAN ED-1, DT-0): what a build target
 * gives the shared app. The app imports `{ platform } from '#platform'`, which Vite's alias and
 * TypeScript's `paths` resolve to exactly one adapter (`platform/web` today), so a build holds
 * one target's code and the app never branches on the target. ED-1 lands the alias and the
 * facts the web policy test pins; DT-0 moves today's file, storage and update code behind it
 * (the lint fence of ED-2 keeps that code in the folders it will move from).
 */

/** The build-time distribution (editions.md §2). */
export type Target = 'web' | 'desktop';

export interface Platform {
  readonly target: Target;
  /**
   * The sources page script may connect to: the CSP's `connect-src`. On the web only the app's
   * own origin, ever (ADR-0007, the privacy promise); desktop adds only its IPC channel.
   */
  readonly connectSources: readonly string[];
  /** Network beyond the origin: none on the web; per connector, through native code, on desktop. */
  readonly network: 'none' | 'scoped';
}
