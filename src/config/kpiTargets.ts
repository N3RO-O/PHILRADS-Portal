/**
 * Yearly targets for the Home scorecard (src/components/dashboard/Scorecard.tsx), set by
 * management. A figure without a target shows its change from last year and its trend only, with
 * no progress bar. Example: { year: 2026, people: 25000, households: 5000, activities: 160, places: 70 }.
 */
export interface KpiTarget {
  year: number;
  people?: number;
  households?: number;
  activities?: number;
  places?: number;
}

export const KPI_TARGETS: KpiTarget[] = [];

export const targetFor = (year: number) => KPI_TARGETS.find((t) => t.year === year) ?? null;
