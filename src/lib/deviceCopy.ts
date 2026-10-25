import { idbDeletePrefix, idbGet, idbPut } from './idb';

const PREFIX = 'copy:';
const isConnectionProblem = (e: unknown) =>
  !navigator.onLine || e instanceof TypeError || (e instanceof Error && /failed to fetch|networkerror|load failed|check the connection|offline/i.test(e.message));

/**
 * Wraps a service's read methods so that, with no connection, they return the last answer saved on
 * this device instead of failing (Home cards, Resources list). Writes are never wrapped.
 */
export function withDeviceCopy<S extends object>(service: S, name: string, methods: (keyof S)[]): S {
  const wrapped = { ...service };
  for (const m of methods) {
    const original = service[m] as unknown as (...args: unknown[]) => Promise<unknown>;
    (wrapped as Record<keyof S, unknown>)[m] = async (...args: unknown[]) => {
      const key = `${PREFIX}${name}:${String(m)}:${JSON.stringify(args)}`;
      try {
        const value = await original(...args);
        void idbPut('kv', value, key).catch(() => undefined);
        return value;
      } catch (e) {
        if (!isConnectionProblem(e)) throw e;
        const saved = await idbGet('kv', key).catch(() => undefined);
        if (saved === undefined) throw e;
        return saved;
      }
    };
  }
  return wrapped;
}

/** On sign-out: forget every saved copy (another person may use this device next). */
export const clearDeviceCopies = () => idbDeletePrefix('kv', PREFIX).catch(() => undefined);
