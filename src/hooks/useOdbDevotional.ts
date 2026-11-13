import { useEffect, useState } from 'react';
import type { OdbDevotional } from '../services/verse/odb';

const PREFIX = 'philrads.odb.v1.';
/** Days kept on the device (today and a few before), so it opens at once and works offline. */
const KEEP = 7;

const read = (day: string): OdbDevotional | null => {
  try {
    const raw = localStorage.getItem(PREFIX + day);
    return raw ? (JSON.parse(raw) as OdbDevotional) : null;
  } catch {
    return null;
  }
};
const keep = (d: OdbDevotional) => {
  try {
    localStorage.setItem(PREFIX + d.day, JSON.stringify(d));
    const days = Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .sort();
    for (const k of days.slice(0, Math.max(0, days.length - KEEP))) localStorage.removeItem(k);
  } catch {
    /* storage full or blocked: it's fetched again next time */
  }
};

const pending = new Map<string, Promise<OdbDevotional | null>>();
function load(day: string): Promise<OdbDevotional | null> {
  let p = pending.get(day);
  if (!p) {
    p = fetch(`/api/weather?devotional=${day}`)
      .then((r) => (r.ok ? (r.json() as Promise<OdbDevotional>) : null))
      .then((d) => (d && d.day === day && Array.isArray(d.body) ? (keep(d), d) : null))
      .catch(() => null)
      .finally(() => pending.delete(day));
    pending.set(day, p);
  }
  return p;
}

/** One day's Our Daily Bread: undefined while loading, null when it couldn't be had (offline, none that day). */
export function useOdbDevotional(day: string): OdbDevotional | null | undefined {
  const [state, setState] = useState<{ day: string; data: OdbDevotional | null | undefined }>(() => ({ day, data: read(day) ?? undefined }));
  useEffect(() => {
    const cached = read(day);
    setState({ day, data: cached ?? undefined });
    if (cached) return;
    let alive = true;
    void load(day).then((d) => alive && setState({ day, data: d }));
    return () => {
      alive = false;
    };
  }, [day]);
  return state.day === day ? state.data : undefined;
}

/** "2026-11-13" plus n days. */
export const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
