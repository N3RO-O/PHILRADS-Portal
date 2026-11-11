import { siteKey, type ProgramActivity } from '../services/activities/types';

/** The figures the scorecard and Statistics count, for a list of activities that have happened. */
export interface Totals {
  activities: number;
  people: number;
  households: number;
  places: number;
}
export type Metric = keyof Totals;

const dateOf = (a: ProgramActivity) => a.startDate ?? a.endDate;

export function totals(list: ProgramActivity[]): Totals {
  const done = list.filter((a) => a.status !== 'scheduled');
  return {
    activities: done.length,
    people: done.reduce((t, a) => t + (a.individualsServed ?? 0), 0),
    households: done.reduce((t, a) => t + (a.householdsServed ?? 0), 0),
    places: new Set(done.filter((a) => a.lat !== null && a.lng !== null).map((a) => siteKey({ lat: a.lat!, lng: a.lng! }))).size,
  };
}

/**
 * The year before `year`, for comparing against. For the current year that is the same stretch of
 * last year (1 January to today's date), counting only records with a date; for a past year it is
 * the whole year before.
 */
export function previousPeriod(list: ProgramActivity[], year: number, today: string): ProgramActivity[] {
  const prev = list.filter((a) => a.year === year - 1);
  if (year !== Number(today.slice(0, 4))) return prev;
  const cutoff = `${year - 1}${today.slice(4)}`;
  return prev.filter((a) => {
    const d = dateOf(a);
    return d !== null && d <= cutoff;
  });
}

/** Running total of a figure month by month through `year`, up to this month for the current year. */
export function monthlyTrend(list: ProgramActivity[], year: number, metric: Metric, today: string): number[] {
  const lastMonth = year === Number(today.slice(0, 4)) ? Number(today.slice(5, 7)) : 12;
  const inYear = list.filter((a) => a.year === year && a.status !== 'scheduled');
  const out: number[] = [];
  for (let m = 1; m <= lastMonth; m++) {
    const end = `${year}-${String(m).padStart(2, '0')}-31`;
    // Undated records join on the last point, so the line ends at the same total the tile shows.
    out.push(
      totals(
        inYear.filter((a) => {
          const d = dateOf(a);
          return d === null ? m === lastMonth : d <= end;
        }),
      )[metric],
    );
  }
  return out;
}
