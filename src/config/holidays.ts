/**
 * Philippine national holidays, from the official proclamations:
 * - 2026: Proclamation No. 1006 (s. 2025); Eid'l Fitr, Proclamation No. 1189 (s. 2026);
 *   Eid'l Adha, Proclamation No. 1264 (s. 2026).
 * - 2027: Proclamation No. 1427 (s. 2026). Eid'l Fitr and Eid'l Adha are proclaimed separately
 *   each year (Islamic calendar): add them here when Malacañang announces the dates.
 * Local (city or provincial) holidays aren't included.
 */

export type HolidayKind = 'regular' | 'special' | 'working';

export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  kind: HolidayKind;
}

export const HOLIDAY_KIND_LABEL: Record<HolidayKind, string> = {
  regular: 'Regular holiday',
  special: 'Special non-working day',
  working: 'Special working day',
};

export const PH_HOLIDAYS: Holiday[] = [
  // 2026
  { date: '2026-01-01', name: 'New Year’s Day', kind: 'regular' },
  { date: '2026-02-17', name: 'Chinese New Year', kind: 'special' },
  { date: '2026-02-25', name: 'EDSA People Power Revolution Anniversary', kind: 'working' },
  { date: '2026-03-20', name: 'Eid’l Fitr', kind: 'regular' },
  { date: '2026-04-02', name: 'Maundy Thursday', kind: 'regular' },
  { date: '2026-04-03', name: 'Good Friday', kind: 'regular' },
  { date: '2026-04-04', name: 'Black Saturday', kind: 'special' },
  { date: '2026-04-09', name: 'Araw ng Kagitingan', kind: 'regular' },
  { date: '2026-05-01', name: 'Labor Day', kind: 'regular' },
  { date: '2026-05-27', name: 'Eid’l Adha', kind: 'regular' },
  { date: '2026-06-12', name: 'Independence Day', kind: 'regular' },
  { date: '2026-08-21', name: 'Ninoy Aquino Day', kind: 'special' },
  { date: '2026-08-31', name: 'National Heroes Day', kind: 'regular' },
  { date: '2026-11-01', name: 'All Saints’ Day', kind: 'special' },
  { date: '2026-11-02', name: 'All Souls’ Day', kind: 'special' },
  { date: '2026-11-30', name: 'Bonifacio Day', kind: 'regular' },
  { date: '2026-12-08', name: 'Feast of the Immaculate Conception of Mary', kind: 'special' },
  { date: '2026-12-24', name: 'Christmas Eve', kind: 'special' },
  { date: '2026-12-25', name: 'Christmas Day', kind: 'regular' },
  { date: '2026-12-30', name: 'Rizal Day', kind: 'regular' },
  { date: '2026-12-31', name: 'Last Day of the Year', kind: 'special' },
  // 2027
  { date: '2027-01-01', name: 'New Year’s Day', kind: 'regular' },
  { date: '2027-02-06', name: 'Chinese New Year', kind: 'special' },
  { date: '2027-02-25', name: 'EDSA People Power Revolution Anniversary', kind: 'working' },
  { date: '2027-03-25', name: 'Maundy Thursday', kind: 'regular' },
  { date: '2027-03-26', name: 'Good Friday', kind: 'regular' },
  { date: '2027-03-27', name: 'Black Saturday', kind: 'special' },
  { date: '2027-04-09', name: 'Araw ng Kagitingan', kind: 'regular' },
  { date: '2027-05-01', name: 'Labor Day', kind: 'regular' },
  { date: '2027-06-12', name: 'Independence Day', kind: 'regular' },
  { date: '2027-08-21', name: 'Ninoy Aquino Day', kind: 'special' },
  { date: '2027-08-30', name: 'National Heroes Day', kind: 'regular' },
  { date: '2027-11-01', name: 'All Saints’ Day', kind: 'special' },
  { date: '2027-11-02', name: 'All Souls’ Day', kind: 'special' },
  { date: '2027-11-30', name: 'Bonifacio Day', kind: 'regular' },
  { date: '2027-12-08', name: 'Feast of the Immaculate Conception of Mary', kind: 'special' },
  { date: '2027-12-24', name: 'Christmas Eve', kind: 'special' },
  { date: '2027-12-25', name: 'Christmas Day', kind: 'regular' },
  { date: '2027-12-30', name: 'Rizal Day', kind: 'regular' },
  { date: '2027-12-31', name: 'Last Day of the Year', kind: 'special' },
];

const BY_DATE = new Map(PH_HOLIDAYS.map((h) => [h.date, h]));

/** The holiday on a day (YYYY-MM-DD), if any. */
export const holidayOn = (day: string): Holiday | undefined => BY_DATE.get(day);

/** Holidays in a month ("YYYY-MM"). */
export const holidaysIn = (month: string): Holiday[] => PH_HOLIDAYS.filter((h) => h.date.startsWith(month));

/** 0 = Monday … 5 = Saturday, 6 = Sunday (the calendars start on Monday). */
export const weekdayIndex = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Day-number colour per weekday and holiday kind (shared by both calendars). */
export const DAY_TONE = {
  saturday: 'text-sky-300',
  sunday: 'text-rose',
  regular: 'text-status-out',
  special: 'text-uplift',
  working: 'text-ink-soft',
} as const;

export const HOLIDAY_STYLE: Record<HolidayKind, { chip: string; dot: string }> = {
  regular: { chip: 'border-status-out/40 bg-status-out/10 text-status-out', dot: 'bg-status-out' },
  special: { chip: 'border-uplift/40 bg-uplift/10 text-uplift', dot: 'bg-uplift' },
  working: { chip: 'border-dashed border-line text-ink-soft', dot: 'bg-ink-mute' },
};
