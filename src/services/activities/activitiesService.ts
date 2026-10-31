import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivitiesService, ProgramActivity, SyncChange, SyncResult } from './types';

// ───────────────────────── Sample data ─────────────────────────

// The real records live in the database (they name partners and contact persons). A developer can
// copy them into src/data/programActivities.local.json (gitignored) to preview with them locally.
const local = import.meta.env.DEV ? import.meta.glob<{ default: ProgramActivity[] }>('../../data/programActivities.local.json') : {};

const blank = { endDate: null, response: null, geoPrecision: 'town', householdsTarget: null, individualsTarget: null, male: null, female: null, servedNote: null, funding: null, fundingNote: null, donors: null, partner: null, contactPerson: null, status: 'completed', source: 'Sample', notes: null } as const;
/** Made-up examples in the same shape, for sample-data mode. Donors and amounts are invented. */
const SAMPLE: ProgramActivity[] = [
  { ...blank, id: 's1', year: 2026, startDate: '2026-06-15', dateLabel: 'June 15, 2026', program: 'emergency', response: 'Sample earthquake', activity: 'Community feeding for children', site: 'Glan, Sarangani', lat: 5.8227, lng: 125.2049, householdsServed: null, individualsServed: 120, male: 60, female: 60, funding: 85000, donors: 'Sample Hope Foundation' },
  { ...blank, id: 's2', year: 2026, startDate: '2026-03-02', dateLabel: 'March 2-6, 2026', program: 'emergency', response: 'Sample storm', activity: 'Food packs and hygiene kits', site: 'Iligan City', lat: 8.2282, lng: 124.2412, householdsServed: 200, individualsServed: 800, funding: 420000, donors: 'Sample Hope Foundation, Grace Sample Church & individual donors' },
  { ...blank, id: 's7', year: 2026, startDate: '2026-10-06', dateLabel: 'October 6-8, 2026', program: 'emergency', response: 'Sample typhoon', activity: 'Family food packs and water kits', site: 'Virac, Catanduanes', lat: 13.5806, lng: 124.2308, householdsServed: 350, individualsServed: 1400, funding: 610000, donors: 'Sample Relief Network' },
  { ...blank, id: 's8', year: 2026, startDate: '2026-10-14', dateLabel: 'October 14, 2026', program: 'training', activity: 'Psychological first aid for church volunteers', site: 'Tacloban City', lat: 11.2444, lng: 125.0039, householdsServed: null, individualsServed: 45, funding: 60000, donors: 'Grace Sample Church' },
  { ...blank, id: 's3', year: 2025, startDate: '2025-11-20', dateLabel: 'November 20, 2025', program: 'emergency', response: 'Sample typhoon', activity: 'Multi-purpose cash assistance', site: 'Catanduanes', lat: 13.8333, lng: 124.25, geoPrecision: 'province', householdsServed: 300, individualsServed: null, funding: 900000, donors: 'Sample Relief Network' },
  { ...blank, id: 's4', year: 2025, startDate: '2025-02-04', dateLabel: 'February 4, 2025', program: 'training', activity: 'Protection awareness session', site: 'Baggao, Cagayan', lat: 17.9342, lng: 121.7717, householdsServed: null, individualsServed: 50 },
  { ...blank, id: 's5', year: 2024, startDate: '2024-09-30', dateLabel: 'September 30, 2024', program: 'rehabilitation', response: 'Sample flood', activity: 'Shelter repair kits', site: 'San Mateo, Rizal', lat: 14.6952, lng: 121.1174, householdsServed: 80, individualsServed: 400, funding: 320000, donors: 'Sample Hope Foundation & Bayanihan Sample Co.' },
  { ...blank, id: 's6', year: 2024, startDate: '2024-02-01', dateLabel: 'February 2024', program: 'livelihood', activity: 'Livelihood training and starter kits', site: 'Nabunturan, Davao de Oro', lat: 7.6, lng: 125.97, householdsServed: null, individualsServed: 28, funding: 150000, donors: 'Bayanihan Sample Co.' },
];

/** Sample-mode records, kept in memory so a sync can be tried without a database. */
let store: ProgramActivity[] | null = null;
async function sampleStore(): Promise<ProgramActivity[]> {
  if (store) return store;
  const load = Object.values(local)[0];
  store = load ? (await load()).default : structuredClone(SAMPLE);
  return store;
}

export const mockActivitiesService: ActivitiesService = {
  source: 'mock',
  async list() {
    const list = await sampleStore();
    return new Promise((r) => setTimeout(() => r(structuredClone(list)), 200));
  },
  async sync(changes: SyncChange[]): Promise<SyncResult> {
    const list = await sampleStore();
    const result: SyncResult = { inserted: 0, updated: 0, funding: 0 };
    for (const c of changes) {
      let rec: ProgramActivity | undefined;
      if (c.action === 'insert') {
        const r = c.row;
        rec = {
          ...blank,
          id: `sync-${Date.now().toString(36)}-${result.inserted}`,
          year: r.year,
          startDate: r.start_date,
          endDate: r.end_date,
          dateLabel: r.date_label,
          program: r.program,
          activity: r.activity,
          site: r.site,
          lat: null,
          lng: null,
          geoPrecision: null,
          householdsTarget: r.households_target,
          individualsTarget: r.individuals_target,
          householdsServed: r.households_served,
          individualsServed: r.individuals_served,
          partner: r.partner,
          contactPerson: r.contact_person,
          status: r.status,
          source: r.source,
          notes: r.notes,
        };
        list.push(rec);
        result.inserted++;
      } else {
        rec = list.find((a) => a.id === c.id);
        if (!rec) throw new Error('A record being updated no longer exists. Reload and review the sync again.');
        const s = c.set;
        if ('households_target' in s) rec.householdsTarget = s.households_target ?? null;
        if ('individuals_target' in s) rec.individualsTarget = s.individuals_target ?? null;
        if ('households_served' in s) rec.householdsServed = s.households_served ?? null;
        if ('individuals_served' in s) rec.individualsServed = s.individuals_served ?? null;
        if ('partner' in s) rec.partner = s.partner ?? null;
        if ('contact_person' in s) rec.contactPerson = s.contact_person ?? null;
        if (Object.keys(s).length) result.updated++;
      }
      if (c.fund && Object.keys(c.fund).length) {
        if ('funding' in c.fund) rec.funding = c.fund.funding ?? null;
        if ('funding_note' in c.fund) rec.fundingNote = c.fund.funding_note ?? null;
        if ('donors' in c.fund) rec.donors = c.fund.donors ?? null;
        result.funding++;
      }
    }
    return result;
  },
};

// ───────────────────────── Supabase ─────────────────────────

// Funding and donors are a separate table that only funding.read can see (others get null).
const COLUMNS =
  'id, year, start_date, end_date, date_label, program, response, activity, site, lat, lng, geo_precision, households_target, individuals_target, households_served, individuals_served, male, female, served_note, partner, contact_person, status, source, notes, fund:program_activity_funding(funding, funding_note, donors)';

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
      return (data ?? []).map((r) => {
        const fund = (Array.isArray(r.fund) ? r.fund[0] : r.fund) as { funding: unknown; funding_note: string | null; donors: string | null } | null | undefined;
        return {
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
          funding: num(fund?.funding),
          fundingNote: fund?.funding_note ?? null,
          donors: fund?.donors ?? null,
          partner: r.partner as string | null,
          contactPerson: r.contact_person as string | null,
          status: r.status as ProgramActivity['status'],
          source: r.source as string | null,
          notes: r.notes as string | null,
        };
      });
    },
    async sync(changes) {
      const { data, error } = await client.rpc('sync_program_activities', { p_changes: changes });
      if (error) {
        console.error('[activities] sync', error);
        throw new Error(error.code === '42501' ? error.message : `The sync was not applied: ${error.message}`);
      }
      return data as SyncResult;
    },
  };
}
