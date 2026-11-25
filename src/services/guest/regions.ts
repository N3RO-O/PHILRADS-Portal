/**
 * The Philippines' 18 regions, for guest alerts: a guest follows some of them (or the whole
 * country), and a typhoon is "near" a region when it is within ALERT_RADIUS_KM of the region's
 * middle. The codes match public.guest_alert_regions() in the database; the guest-alerts Edge
 * Function keeps its own copy of the centres (supabase/functions/guest-alerts).
 */
export interface Region {
  code: string;
  name: string;
  /** Roughly the middle of the region. */
  lat: number;
  lng: number;
}

export const REGIONS: Region[] = [
  { code: 'NCR', name: 'Metro Manila (NCR)', lat: 14.6, lng: 121.0 },
  { code: 'CAR', name: 'Cordillera (CAR)', lat: 17.35, lng: 121.0 },
  { code: 'R1', name: 'Ilocos Region', lat: 16.6, lng: 120.4 },
  { code: 'R2', name: 'Cagayan Valley', lat: 17.2, lng: 121.7 },
  { code: 'R3', name: 'Central Luzon', lat: 15.4, lng: 120.7 },
  { code: 'R4A', name: 'CALABARZON', lat: 14.1, lng: 121.4 },
  { code: 'MIMAROPA', name: 'MIMAROPA', lat: 12.0, lng: 120.5 },
  { code: 'R5', name: 'Bicol Region', lat: 13.4, lng: 123.5 },
  { code: 'R6', name: 'Western Visayas', lat: 11.0, lng: 122.4 },
  { code: 'NIR', name: 'Negros Island Region', lat: 10.2, lng: 122.9 },
  { code: 'R7', name: 'Central Visayas', lat: 10.2, lng: 123.8 },
  { code: 'R8', name: 'Eastern Visayas', lat: 11.5, lng: 125.0 },
  { code: 'R9', name: 'Zamboanga Peninsula', lat: 7.8, lng: 122.8 },
  { code: 'R10', name: 'Northern Mindanao', lat: 8.2, lng: 124.6 },
  { code: 'R11', name: 'Davao Region', lat: 7.2, lng: 125.8 },
  { code: 'R12', name: 'SOCCSKSARGEN', lat: 6.5, lng: 124.8 },
  { code: 'R13', name: 'Caraga', lat: 8.8, lng: 125.8 },
  { code: 'BARMM', name: 'Bangsamoro (BARMM)', lat: 6.9, lng: 124.2 },
];

export const regionName = (code: string) => REGIONS.find((r) => r.code === code)?.name ?? code;

/** A typhoon this close to a region's middle gets an alert out to the guests who follow it. */
export const ALERT_RADIUS_KM = 500;

/** Distance in km on the earth's surface. */
export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
