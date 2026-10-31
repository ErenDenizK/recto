/**
 * Whether this browser reports a camera (DSN-87, owner question Q4): the Scan tile shows only
 * where `enumerateDevices` lists a `videoinput`. Device kinds are listed without permission.
 * False until the answer arrives, and wherever the API is missing; the scan sheet itself keeps
 * its own flag rules (`scan/scan-flag.ts`).
 */
import { useEffect, useState } from 'react';

export async function hasCamera(devices = globalThis.navigator?.mediaDevices): Promise<boolean> {
  if (devices?.enumerateDevices === undefined) return false;
  try {
    return (await devices.enumerateDevices()).some((d) => d.kind === 'videoinput');
  } catch {
    return false;
  }
}

export function useHasCamera(wanted: boolean): boolean {
  const [found, setFound] = useState(false);
  useEffect(() => {
    if (!wanted) return undefined;
    let cancelled = false;
    void hasCamera().then((has) => {
      if (!cancelled) setFound(has);
    });
    return () => {
      cancelled = true;
    };
  }, [wanted]);
  return wanted && found;
}
