import { useCallback, useMemo, useRef } from 'react';

/**
 * Request sequencing guard for async list loads.
 *
 * Every load call takes a fresh sequence number; stale responses (from a
 * previous filter/page change) are detected via `isCurrent` and discarded so
 * the UI never renders out-of-order data.
 *
 * The returned object is memoized so it can be used directly in `useCallback`
 * dependency arrays without retriggering effects on every render.
 */
export function useRequestGuard() {
  const sequenceRef = useRef(0);

  const next = useCallback(() => {
    sequenceRef.current += 1;
    return sequenceRef.current;
  }, []);

  const isCurrent = useCallback((sequence: number) => sequence === sequenceRef.current, []);

  return useMemo(() => ({ next, isCurrent }), [next, isCurrent]);
}
