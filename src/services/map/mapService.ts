import type { SupabaseClient } from '@supabase/supabase-js';
import { PLACEHOLDER_ROLE_PERMISSIONS } from '../../config/permissions';
import { demoProfile } from '../../data/mockDashboard';
import { MapRuleError, type CheckIn, type LiveEvent, type LivePosition, type MapPlace, type MapService, type PlaceDraft, type PlaceKind } from './types';

// ───────────────────────── Sample data (this browser only) ─────────────────────────

const STORE_KEY = 'philrads.sample.map.v2';
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** Real towns, invented sites. Names of stock locations match the sample IMS data. */
const seedPlaces = (): MapPlace[] =>
  (
    [
      ['p-mnl', 'Main Manila Warehouse', 'warehouse', 14.5869, 120.9772, 'Port Area, Manila', 'Main Manila Warehouse', null],
      // Molave St., Project 3 (OpenStreetMap has the street, not the building number).
      ['p-qc', 'PHILRADS Office', 'office', 14.62925, 121.06675, '1st/F Evangelical Center, 62 Molave St., Project 3, Quezon City 1102', null, null],
      ['p-ceb', 'Cebu Hub', 'hub', 10.3157, 123.8854, 'Cebu City', 'Cebu Hub', null],
      ['p-tac', 'Tacloban Field Hub', 'hub', 11.2444, 125.0039, 'Tacloban City, Leyte', 'Tacloban Field Hub', 'sample-ev-1'],
      ['p-bcl', 'Legazpi Field Drop-off Point', 'distribution_point', 13.1391, 123.7438, 'Legazpi City, Albay', 'Legazpi Field Drop-off Point', null],
      ['p-palo', 'Candahug Evacuation Center', 'evacuation_center', 11.1622, 124.9921, 'Brgy. Candahug, Palo, Leyte', null, 'sample-ev-1'],
      ['p-sag', 'Sagkahan Distribution Point', 'distribution_point', 11.2367, 125.0126, 'Brgy. 62 Sagkahan, Tacloban', null, 'sample-ev-1'],
      ['p-guiuan', 'Guiuan Response Site', 'response_site', 11.0333, 125.7247, 'Guiuan, Eastern Samar', null, null],
    ] as const
  ).map(([id, name, kind, lat, lng, address, imsLocation, imsEventId]) => ({
    id,
    name,
    kind: kind as PlaceKind,
    lat,
    lng,
    address,
    notes: null,
    imsLocation,
    imsEventId,
    updatedAt: minutesAgo(60 * 24 * 3),
  }));

const seedCheckIns = (): CheckIn[] => [
  { id: 'c-1', profileId: 'u-maria', name: 'Maria Santos', lat: 11.2371, lng: 125.0119, accuracyM: 15, note: 'Distribution day 2 at Sagkahan', createdAt: minutesAgo(25), mine: false },
  { id: 'c-2', profileId: 'u-jun', name: 'Jun Dela Cruz', lat: 11.1618, lng: 124.9915, accuracyM: 30, note: 'Counting families at the center', createdAt: minutesAgo(70), mine: false },
  { id: 'c-3', profileId: 'u-liza', name: 'Liza Mendoza', lat: 13.1395, lng: 123.7441, accuracyM: 12, note: null, createdAt: minutesAgo(190), mine: false },
  { id: 'c-4', profileId: 'u-paolo', name: 'Paolo Garcia', lat: 10.318, lng: 123.889, accuracyM: 40, note: 'Loading the truck for Leyte', createdAt: minutesAgo(400), mine: false },
];

interface SampleState {
  places: MapPlace[];
  checkIns: CheckIn[];
}
let sample: SampleState | null = null;
const state = (): SampleState => {
  if (sample) return sample;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return (sample = JSON.parse(raw) as SampleState);
  } catch {
    /* fall back to the seed */
  }
  return (sample = { places: seedPlaces(), checkIns: seedCheckIns() });
};
const persist = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state()));
  } catch {
    /* storage unavailable: changes last until reload */
  }
};
const later = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 180));
const demoCan = (p: 'map.manage' | 'map.checkin') => {
  let role = demoProfile.roleKey;
  try {
    role = localStorage.getItem('philrads.demo.role') ?? role;
  } catch {
    /* default role */
  }
  return (PLACEHOLDER_ROLE_PERMISSIONS[role] ?? []).includes(p);
};
const recent = (c: CheckIn) => Date.now() - Date.parse(c.createdAt) < 24 * 3600_000;
const checkPlace = (d: PlaceDraft) => {
  if (!d.name.trim()) throw new MapRuleError('Give the place a name.');
  if (!Number.isFinite(d.lat) || !Number.isFinite(d.lng) || Math.abs(d.lat) > 90 || Math.abs(d.lng) > 180) throw new MapRuleError('Set where the place is on the map.');
};

// Sample live sharing: two teammates walking around Tacloban, plus you when you share.
const hoursAhead = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
let sampleLive: LivePosition[] = [
  { profileId: 'u-maria', name: 'Maria Santos', lat: 11.2372, lng: 125.0118, accuracyM: 8, heading: 40, speedMps: 1.2, updatedAt: new Date().toISOString(), sharingUntil: hoursAhead(3), mine: false },
  { profileId: 'u-jun', name: 'Jun Dela Cruz', lat: 11.1628, lng: 124.9925, accuracyM: 12, heading: 200, speedMps: 0.9, updatedAt: new Date().toISOString(), sharingUntil: hoursAhead(1.5), mine: false },
];
const liveListeners = new Set<(e: LiveEvent) => void>();
const emit = (e: LiveEvent) => liveListeners.forEach((l) => l(e));
let walker: ReturnType<typeof setInterval> | null = null;
const walk = () => {
  sampleLive = sampleLive.map((p) => {
    if (p.mine) return p;
    const h = ((p.heading ?? 0) + (Math.random() * 50 - 25) + 360) % 360;
    const step = 0.00012 + Math.random() * 0.00008; // roughly 15–20 m
    const moved = { ...p, heading: h, lat: p.lat + step * Math.cos((h * Math.PI) / 180), lng: p.lng + step * Math.sin((h * Math.PI) / 180), updatedAt: new Date().toISOString() };
    emit({ type: 'upsert', position: moved });
    return moved;
  });
};

export const mockMapService: MapService = {
  source: 'mock',
  async listPlaces() {
    if (!navigator.onLine) throw new TypeError('Failed to fetch (offline)');
    return later(structuredClone(state().places));
  },
  async savePlace(d) {
    if (!demoCan('map.manage')) throw new MapRuleError('Your role can see the map but not change places.');
    checkPlace(d);
    const place: MapPlace = {
      id: d.id ?? `p-${crypto.randomUUID?.() ?? Date.now()}`,
      name: d.name.trim(),
      kind: d.kind,
      lat: d.lat,
      lng: d.lng,
      address: d.address.trim() || null,
      notes: d.notes.trim() || null,
      imsLocation: d.imsLocation,
      imsEventId: d.imsEventId,
      updatedAt: new Date().toISOString(),
    };
    const s = state();
    s.places = d.id ? s.places.map((p) => (p.id === d.id ? place : p)) : [...s.places, place];
    persist();
    return later(structuredClone(place));
  },
  async removePlace(id) {
    if (!demoCan('map.manage')) throw new MapRuleError('Your role can see the map but not change places.');
    state().places = state().places.filter((p) => p.id !== id);
    persist();
    await later(null);
  },
  async listCheckIns() {
    if (!navigator.onLine) throw new TypeError('Failed to fetch (offline)');
    return later(structuredClone(state().checkIns.filter(recent).sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
  },
  async checkIn(d) {
    if (!demoCan('map.checkin')) throw new MapRuleError('Your role can see the map but not check in.');
    const c: CheckIn = {
      id: `c-${crypto.randomUUID?.() ?? Date.now()}`,
      profileId: demoProfile.id,
      name: demoProfile.displayName,
      lat: d.lat,
      lng: d.lng,
      accuracyM: d.accuracyM,
      note: d.note.trim() || null,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    state().checkIns = [c, ...state().checkIns];
    persist();
    return later(structuredClone(c));
  },
  async removeCheckIn(id) {
    state().checkIns = state().checkIns.filter((c) => c.id !== id || !c.mine);
    persist();
    await later(null);
  },
  async listLive() {
    return later(structuredClone(sampleLive.filter((p) => Date.parse(p.sharingUntil) > Date.now())));
  },
  async shareLive(fix, sharingUntil) {
    if (!demoCan('map.checkin')) throw new MapRuleError('Your role can see the map but not share your location.');
    const prev = sampleLive.find((p) => p.mine);
    const me: LivePosition = { profileId: demoProfile.id, name: demoProfile.displayName, ...fix, updatedAt: new Date().toISOString(), sharingUntil, mine: true };
    sampleLive = prev ? sampleLive.map((p) => (p.mine ? me : p)) : [...sampleLive, me];
    emit({ type: 'upsert', position: me });
  },
  async stopLive() {
    sampleLive = sampleLive.filter((p) => !p.mine);
    emit({ type: 'remove', profileId: demoProfile.id });
  },
  subscribeLive(onEvent) {
    liveListeners.add(onEvent);
    walker ??= setInterval(walk, 3000);
    return () => {
      liveListeners.delete(onEvent);
      if (liveListeners.size === 0 && walker) {
        clearInterval(walker);
        walker = null;
      }
    };
  },
};

// ───────────────────────── Supabase ─────────────────────────

/** Live map. Row Level Security decides who sees (map.read), changes places (map.manage) and checks in (map.checkin). */
export function createSupabaseMapService(client: SupabaseClient): MapService {
  const fail = (what: string, error: { message: string; code?: string }): never => {
    console.error(`[map] ${what}`, error);
    if (error.code === '42501') throw new MapRuleError('Your role does not allow this.');
    if (error.code && error.code.startsWith('23')) throw new MapRuleError('The server rejected this. Check the name and the pin.');
    throw new Error(`Could not ${what}. Check the connection and try again.`);
  };
  const me = async () => (await client.auth.getSession()).data.session?.user.id ?? null;
  const placeColumns = 'id, name, kind, lat, lng, address, notes, ims_location, ims_event_id, updated_at';
  const mapPlace = (r: Record<string, unknown>): MapPlace => ({
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as PlaceKind,
    lat: Number(r.lat),
    lng: Number(r.lng),
    address: (r.address as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    imsLocation: (r.ims_location as string | null) ?? null,
    imsEventId: (r.ims_event_id as string | null) ?? null,
    updatedAt: r.updated_at as string,
  });
  const checkColumns = 'id, profile_id, lat, lng, accuracy_m, note, created_at, person:profiles!field_checkins_profile_id_fkey(display_name, full_name)';
  const mapCheck = (r: Record<string, unknown>, uid: string | null): CheckIn => {
    const person = r.person as { display_name?: string; full_name?: string } | null;
    return {
      id: r.id as string,
      profileId: r.profile_id as string,
      name: person?.full_name || person?.display_name || 'Team member',
      lat: Number(r.lat),
      lng: Number(r.lng),
      accuracyM: r.accuracy_m == null ? null : Number(r.accuracy_m),
      note: (r.note as string | null) ?? null,
      createdAt: r.created_at as string,
      mine: r.profile_id === uid,
    };
  };

  return {
    source: 'supabase',
    async listPlaces() {
      const { data, error } = await client.from('map_places').select(placeColumns).eq('is_active', true).order('name').limit(2000);
      if (error) fail('load the map', error);
      return (data ?? []).map(mapPlace);
    },
    async savePlace(d) {
      checkPlace(d);
      const row = {
        name: d.name.trim(),
        kind: d.kind,
        lat: d.lat,
        lng: d.lng,
        address: d.address.trim() || null,
        notes: d.notes.trim() || null,
        ims_location: d.imsLocation,
        ims_event_id: d.imsEventId,
      };
      const q = d.id ? client.from('map_places').update(row).eq('id', d.id) : client.from('map_places').insert(row);
      const { data, error } = await q.select(placeColumns).single();
      if (error) fail('save this place', error);
      return mapPlace(data as Record<string, unknown>);
    },
    async removePlace(id) {
      const { error } = await client.from('map_places').update({ is_active: false }).eq('id', id);
      if (error) fail('remove this place', error);
    },
    async listCheckIns() {
      const uid = await me();
      const { data, error } = await client.from('field_checkins').select(checkColumns).order('created_at', { ascending: false }).limit(500);
      if (error) fail('load team check-ins', error);
      return (data ?? []).map((r) => mapCheck(r as Record<string, unknown>, uid));
    },
    async checkIn(d) {
      const uid = await me();
      const { data, error } = await client
        .from('field_checkins')
        .insert({ lat: d.lat, lng: d.lng, accuracy_m: d.accuracyM, note: d.note.trim() || null })
        .select(checkColumns)
        .single();
      if (error) fail('check you in', error);
      return mapCheck(data as Record<string, unknown>, uid);
    },
    async removeCheckIn(id) {
      const { error } = await client.from('field_checkins').delete().eq('id', id);
      if (error) fail('remove your check-in', error);
    },
    async listLive() {
      const uid = await me();
      const { data, error } = await client
        .from('live_locations')
        .select('profile_id, lat, lng, accuracy_m, heading, speed_mps, updated_at, sharing_until, person:profiles!live_locations_profile_id_fkey(display_name, full_name)')
        .gt('sharing_until', new Date().toISOString());
      if (error) fail('load live locations', error);
      return (data ?? []).map((r) => {
        const person = (r as Record<string, unknown>).person as { display_name?: string; full_name?: string } | null;
        return { ...mapLive(r as Record<string, unknown>, uid), name: person?.full_name || person?.display_name || 'Team member' };
      });
    },
    async shareLive(fix, sharingUntil) {
      const uid = await me();
      if (!uid) throw new MapRuleError('Sign in again to share your location.');
      const { error } = await client.from('live_locations').upsert(
        { profile_id: uid, lat: fix.lat, lng: fix.lng, accuracy_m: fix.accuracyM, heading: fix.heading, speed_mps: fix.speedMps, sharing_until: sharingUntil },
        { onConflict: 'profile_id' },
      );
      if (error) fail('share your location', error);
    },
    async stopLive() {
      const uid = await me();
      if (!uid) return;
      const { error } = await client.from('live_locations').delete().eq('profile_id', uid);
      if (error) fail('stop sharing', error);
    },
    subscribeLive(onEvent) {
      let uid: string | null = null;
      void me().then((u) => (uid = u));
      const channel = client
        .channel(`live-locations-${crypto.randomUUID?.() ?? Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations' }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { profile_id?: string }).profile_id;
            if (id) onEvent({ type: 'remove', profileId: id });
            return;
          }
          const row = payload.new as Record<string, unknown>;
          if (Date.parse(row.sharing_until as string) <= Date.now()) onEvent({ type: 'remove', profileId: row.profile_id as string });
          else onEvent({ type: 'upsert', position: mapLive(row, uid) });
        })
        .subscribe();
      return () => void client.removeChannel(channel);
    },
  };
}

const num = (v: unknown) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
function mapLive(r: Record<string, unknown>, uid: string | null): Omit<LivePosition, 'name'> {
  return {
    profileId: r.profile_id as string,
    lat: Number(r.lat),
    lng: Number(r.lng),
    accuracyM: num(r.accuracy_m),
    heading: num(r.heading),
    speedMps: num(r.speed_mps),
    updatedAt: r.updated_at as string,
    sharingUntil: r.sharing_until as string,
    mine: r.profile_id === uid,
  };
}
