const TZ = 'Asia/Manila';

export const formatNumber = (n: number) => new Intl.NumberFormat('en-PH').format(n);

export const formatLongDate = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ }).format(d);

/** For calendar dates stored as YYYY-MM-DD (no time zone). */
export const formatShortDate = (isoDate: string) =>
  new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${isoDate.slice(0, 10)}T00:00:00Z`),
  );

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date(iso));

export const formatDayHeading = (iso: string) =>
  new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'short', day: 'numeric', timeZone: TZ }).format(new Date(iso));

/** YYYY-MM-DD of an instant in Manila time, for grouping. */
export const manilaDayKey = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
};

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
