import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error };

/**
 * Load data once (and again on reload()). Ignores results from stale requests. refresh() loads
 * again while the current data stays on screen (no loading state, so nothing jumps); if it fails,
 * the current data is kept.
 */
export function useAsyncData<T>(load: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState({ n: 0, quiet: false });

  useEffect(() => {
    let current = true;
    if (!attempt.quiet) setState({ status: 'loading' });
    load()
      .then((data) => current && setState({ status: 'success', data }))
      .catch((err: unknown) => current && setState((s) => (attempt.quiet && s.status === 'success' ? s : { status: 'error', error: err instanceof Error ? err : new Error(String(err)) })));
    return () => {
      current = false;
    };
    // `load` is expected to be a stable service method.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const reload = useCallback(() => setAttempt((a) => ({ n: a.n + 1, quiet: false })), []);
  const refresh = useCallback(() => setAttempt((a) => ({ n: a.n + 1, quiet: true })), []);
  return { ...state, reload, refresh };
}
