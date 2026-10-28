import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivitiesService, ProgramActivity } from './types';

// ───────────────────────── Sample data ─────────────────────────

// The real records live in the database (they name partners and contact persons). A developer can
// copy them into src/data/programActivities.local.json (gitignored) to preview with them locally.
const local = import.meta.env.DEV ? import.meta.glob<{ default: ProgramActivity[] }>('../../data/programActivities.local.json') : {};

const blank = { endDate: null, response: null, geoPrecision: 'town', householdsTarget: null, individualsTarget: null, male: null, female: null, servedNote: null, funding: null, fundingNote: null, donors: null, partner: null, contactPerson: null, status: 'completed', source: 'Sample', notes: null } as const;
/** Made-up examples in the same shape, for sample-data mode. */
const SAMPLE: ProgramActivity[] = [
  { ...blank, id: 's1', year: 2026, startDate: '2026-06-15', dateLabel: 'June 15, 2026', program: 'emergency', response: 'Sample earthquake', activity: 'Community feeding for children', site: 'Glan, Sarangani', lat: 5.8227, lng: 125.2049, householdsServed: null, individualsServed: 120, male: 60, female: 60 },
  { ...blank, id: 's2', year: 2026, startDate: '2026-03-02', dateLabel: 'March 2-6, 2026', program: 'emergency', response: 'Sample storm', activity: 'Food packs and hygiene kits', site: 'Iligan City', lat: 8.2282, lng: 124.2412, householdsServed: 200, individualsServed: 800, donors: 'Sample donor' },
  { ...blank, id: 's3', year: 2025, startDate: '2025-11-20', dateLabel: 'November 20, 2025', program: 'emergency', response: 'Sample typhoon', activity: 'Multi-purpose cash assistance', site: 'Catanduanes', lat: 13.8333, lng: 124.25, geoPrecision: 'province', householdsServed: 300, individualsServed: null },
  { ...blank, id: 's4', year: 2025, startDate: '2025-02-04', dateLabel: 'February 4, 2025', program: 'training', activity: 'Protection awareness session', site: 'Baggao, Cagayan', lat: 17.9342, lng: 121.7717, householdsServed: null, individualsServed: 50 },
  { ...blank, id: 's5', year: 2024, startDate: '2024-09-30', dateLabel: 'September 30, 2024', program: 'rehabilitation', response: 'Sample flood', activity: 'Shelter repair kits', site: 'San Mateo, Rizal', lat: 14.6952, lng: 121.1174, householdsServed: 80, individualsServed: 400 },
  { ...blank, id: 's6', year: 2024, startDate: '2024-02-01', dateLabel: 'February 2024', program: 'livelihood', activity: 'Livelihood training and starter kits', site: 'Nabunturan, Davao de Oro', lat: 7.6, lng: 125.97, householdsServed: null, individualsServed: 28 },
];

export const mockActivitiesService: ActivitiesService = {
  source: 'mock',
  async list() {
    const load = Object.values(local)[0];
    if (load) return (await load()).default;
    return new Promise((r) => setTimeout(() => r(structuredClone(SAMPLE)), 200));
  },
};

// ───────────────────────── Supabase ─────────────────────────

const COLUMNS =
  'id, year, start_date, end_date, date_label, program, response, activity, site, lat, lng, geo_precision, households_target, individuals_target, households_served, individuals_served, male, female, served_note, funding, funding_note, donors, partner, contact_person, status, source, notes';

/** Records of PHILRADS projects and activities. Row Level Security: map.read (or projects.manage) to read. */
export function createSupabaseActivitiesService(client: SupabaseClient): ActivitiesService {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    source: 'supabase',
    async list() {
      const { data, error } = await client.from('program_activities').select(COLUMNS).eq('is_active', true).order('year', { ascending: false }).limit(5000);
      if (error) {
        console.error('[activities] list', error);
        throw new Error('Could not load the statistics. Check the connection and try again.');
      }
      return (data ?? []).map((r) => ({
        id: r.id as string,
        year: r.year as number,
        startDate: r.start_date as string | null,
        endDate: r.end_date as string | null,
        dateLabel: r.date_label as string,
        program: r.program as ProgramActivity['program'],
        response: r.response as string | null,
        activity: r.activity as string,
        site: r.site as string,
        lat: num(r.lat),
        lng: num(r.lng),
        geoPrecision: r.geo_precision as ProgramActivity['geoPrecision'],
        householdsTarget: num(r.households_target),
        individualsTarget: num(r.individuals_target),
        householdsServed: num(r.households_served),
        individualsServed: num(r.individuals_served),
        male: num(r.male),
        female: num(r.female),
        servedNote: r.served_note as string | null,
        funding: num(r.funding),
        fundingNote: r.funding_note as string | null,
        donors: r.donors as string | null,
        partner: r.partner as string | null,
        contactPerson: r.contact_person as string | null,
        status: r.status as ProgramActivity['status'],
        source: r.source as string | null,
        notes: r.notes as string | null,
      }));
    },
  };
}
