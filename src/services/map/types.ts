import type { DataSource } from '../../types';

/** Kinds of place on the Live Map, with the colour of their pin. */
export const PLACE_KINDS = [
  { key: 'warehouse', label: 'Warehouse', plural: 'Warehouses', color: '#EC952A' },
  { key: 'hub', label: 'Field hub', plural: 'Field hubs', color: '#F3AE57' },
  { key: 'response_site', label: 'Response site', plural: 'Response sites', color: '#D97B7B' },
  { key: 'distribution_point', label: 'Distribution point', plural: 'Distribution points', color: '#4ADE80' },
  { key: 'evacuation_center', label: 'Evacuation center', plural: 'Evacuation centers', color: '#C4B5FD' },
  { key: 'office', label: 'Office', plural: 'Offices', color: '#9CC9F5' },
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number]['key'];
export const kindMeta = (k: string) => PLACE_KINDS.find((p) => p.key === k) ?? PLACE_KINDS[0];

export interface MapPlace {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  address: string | null;
  notes: string | null;
  /** PHILRADS IMS storage location name: the map shows that location's live stock. */
  imsLocation: string | null;
  /** PHILRADS IMS relief event: the map shows people served there. */
  imsEventId: string | null;
  updatedAt: string;
}

export interface PlaceDraft {
  id?: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  address: string;
  notes: string;
  imsLocation: string | null;
  imsEventId: string | null;
}

/** "Check in here": where a team member said they were, shared on purpose. Visible for 24 hours. */
export interface CheckIn {
  id: string;
  profileId: string;
  name: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  note: string | null;
  createdAt: string;
  mine: boolean;
}

export interface CheckInDraft {
  lat: number;
  lng: number;
  accuracyM: number | null;
  note: string;
}

/** Opt-in live location: the latest position of someone sharing right now (no trail). */
export interface LivePosition {
  profileId: string;
  name: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  heading: number | null;
  speedMps: number | null;
  updatedAt: string;
  sharingUntil: string;
  mine: boolean;
}

export interface LiveFix {
  lat: number;
  lng: number;
  accuracyM: number | null;
  heading: number | null;
  speedMps: number | null;
}

export type LiveEvent = { type: 'upsert'; position: Omit<LivePosition, 'name'> & { name?: string } } | { type: 'remove'; profileId: string };

export class MapRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapRuleError';
  }
}

export interface MapService {
  readonly source: DataSource;
  listPlaces(): Promise<MapPlace[]>;
  savePlace(draft: PlaceDraft): Promise<MapPlace>;
  /** Takes it off the map; its history stays. */
  removePlace(id: string): Promise<void>;
  /** Everyone's check-ins from the last 24 hours, newest first. */
  listCheckIns(): Promise<CheckIn[]>;
  checkIn(draft: CheckInDraft): Promise<CheckIn>;
  removeCheckIn(id: string): Promise<void>;
  /** Everyone sharing their live location right now. */
  listLive(): Promise<LivePosition[]>;
  /** Start sharing, or send a newer position, until `sharingUntil` (ISO, at most 24 h ahead). */
  shareLive(fix: LiveFix, sharingUntil: string): Promise<void>;
  /** Stop sharing: your position is removed from everyone's map. */
  stopLive(): Promise<void>;
  /** Positions as they change, within seconds. Returns a function that stops listening. */
  subscribeLive(onEvent: (e: LiveEvent) => void): () => void;
}
