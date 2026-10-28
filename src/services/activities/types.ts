import type { DataSource } from '../../types';

/** PHILRADS program areas, as in the statistics database. */
export const PROGRAMS = [
  { key: 'emergency', label: 'Emergency response', short: 'Emergency', color: '#E07A7A' },
  { key: 'rehabilitation', label: 'Rehabilitation and recovery', short: 'Rehabilitation', color: '#60A5FA' },
  { key: 'livelihood', label: 'Sustainable livelihood', short: 'Livelihood', color: '#4ADE80' },
  { key: 'training', label: 'Training and capacity building', short: 'Training', color: '#C4B5FD' },
  { key: 'special', label: 'Special projects', short: 'Special', color: '#F3AE57' },
  { key: 'monitoring', label: 'Monitoring and coordination', short: 'Monitoring', color: '#A3A3AD' },
] as const;
export type ProgramKey = (typeof PROGRAMS)[number]['key'];
export const programMeta = (k: string) => PROGRAMS.find((p) => p.key === k) ?? PROGRAMS[0];

export type ActivityStatus = 'completed' | 'ongoing' | 'scheduled';

/** One activity at one site. Counts are as recorded: any of them can be missing. */
export interface ProgramActivity {
  id: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  /** The date as written in the source records. */
  dateLabel: string;
  program: ProgramKey;
  /** The disaster or initiative ("Severe Tropical Storm Uwan"). */
  response: string | null;
  activity: string;
  site: string;
  lat: number | null;
  lng: number | null;
  geoPrecision: 'barangay' | 'town' | 'province' | 'approximate' | null;
  householdsTarget: number | null;
  individualsTarget: number | null;
  householdsServed: number | null;
  individualsServed: number | null;
  male: number | null;
  female: number | null;
  servedNote: string | null;
  funding: number | null;
  fundingNote: string | null;
  donors: string | null;
  partner: string | null;
  contactPerson: string | null;
  status: ActivityStatus;
  source: string | null;
  notes: string | null;
}

export interface ActivitiesService {
  readonly source: DataSource;
  list(): Promise<ProgramActivity[]>;
}

/** Activities at the same spot, for one pin on the map. */
export interface ActivitySite {
  key: string;
  lat: number;
  lng: number;
  /** The most specific site name among them. */
  name: string;
  activities: ProgramActivity[];
  /** The program with the most activities here (the pin's colour). */
  program: ProgramKey;
  households: number;
  individuals: number;
}

export const siteKey = (a: { lat: number; lng: number }) => `${a.lat.toFixed(4)},${a.lng.toFixed(4)}`;

/** Group mapped activities by spot, newest first within each. */
export function groupSites(list: ProgramActivity[]): ActivitySite[] {
  const sites = new Map<string, ActivitySite>();
  for (const a of list) {
    if (a.lat === null || a.lng === null) continue;
    const key = siteKey({ lat: a.lat, lng: a.lng });
    const s = sites.get(key) ?? { key, lat: a.lat, lng: a.lng, name: a.site, activities: [], program: a.program, households: 0, individuals: 0 };
    s.activities.push(a);
    s.households += a.householdsServed ?? 0;
    s.individuals += a.individualsServed ?? 0;
    sites.set(key, s);
  }
  for (const s of sites.values()) {
    s.activities.sort(byNewest);
    // The name used most often here (the shorter one on a tie).
    const names = new Map<string, number>();
    for (const a of s.activities) names.set(a.site, (names.get(a.site) ?? 0) + 1);
    s.name = [...names.entries()].sort((x, y) => y[1] - x[1] || x[0].length - y[0].length)[0][0];
    const count = new Map<ProgramKey, number>();
    for (const a of s.activities) count.set(a.program, (count.get(a.program) ?? 0) + 1);
    s.program = [...count.entries()].sort((x, y) => y[1] - x[1])[0][0];
  }
  return [...sites.values()];
}

export const byNewest = (a: ProgramActivity, b: ProgramActivity) => b.year - a.year || (b.startDate ?? '').localeCompare(a.startDate ?? '');

/** "2,296 households · 4,000 individuals", or what was recorded instead. */
export function servedText(a: ProgramActivity): string {
  const parts: string[] = [];
  const nf = new Intl.NumberFormat('en-PH');
  if (a.householdsServed !== null) parts.push(`${nf.format(a.householdsServed)} household${a.householdsServed === 1 ? '' : 's'}`);
  if (a.individualsServed !== null) parts.push(`${nf.format(a.individualsServed)} ${a.individualsServed === 1 ? 'person' : 'people'}`);
  if (!parts.length && a.servedNote) parts.push(a.servedNote);
  return parts.join(' · ');
}
