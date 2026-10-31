/**
 * Reads the PHILRADS statistics workbook ("Database- Statistics-2023-2026.xlsx"): one sheet per year,
 * a two-row header (Date | one column per program | participants (target / actual, households /
 * individuals) | Project Area Location | Total Funding | Donors | Church Partner | Contact Person),
 * then one row per activity. Columns are found by their titles, so a moved or added column still works.
 */
import type { ProgramKey } from '../services/activities/types';

export interface WorkbookRow {
  /** Spreadsheet row number (as Excel shows it), for messages. */
  line: number;
  sheet: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  dateLabel: string;
  program: ProgramKey;
  activity: string;
  site: string | null;
  householdsTarget: number | null;
  individualsTarget: number | null;
  householdsServed: number | null;
  individualsServed: number | null;
  funding: number | null;
  fundingNote: string | null;
  donors: string | null;
  partner: string | null;
  contactPerson: string | null;
  /** Things corrected while reading (e.g. a year typo), shown in the review. */
  warnings: string[];
}

export interface SkippedRow {
  line: number;
  sheet: string;
  reason: string;
}

export interface WorkbookYear {
  sheet: string;
  year: number;
  rows: WorkbookRow[];
  skipped: SkippedRow[];
}

type Cell = string | number | boolean | Date | null;
type Role =
  | { kind: 'date' }
  | { kind: 'program'; program: ProgramKey }
  | { kind: 'count'; field: 'householdsTarget' | 'individualsTarget' | 'householdsServed' | 'individualsServed' }
  | { kind: 'text'; field: 'site' | 'donors' | 'partner' | 'contactPerson' }
  | { kind: 'funding' };

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad = (n: number) => String(n).padStart(2, '0');
const clean = (c: Cell): string | null => {
  if (c === null || c === undefined || typeof c === 'boolean') return null;
  if (c instanceof Date) return null;
  const s = String(c).replace(/\s+/g, ' ').trim();
  return s ? s : null;
};

/** Which field a column holds, from its title and the sub-title under it. */
function roleOf(title: string, sub: string): Role | null {
  const t = title.toLowerCase();
  const s = sub.toLowerCase();
  if (t === 'date') return { kind: 'date' };
  if (/emergency/.test(t)) return { kind: 'program', program: 'emergency' };
  if (/rehabilitation|recovery/.test(t)) return { kind: 'program', program: 'rehabilitation' };
  if (/livelihood/.test(t)) return { kind: 'program', program: 'livelihood' };
  if (/training|leadership|capacity/.test(t)) return { kind: 'program', program: 'training' };
  if (/special/.test(t)) return { kind: 'program', program: 'special' };
  if (/monitoring/.test(t)) return { kind: 'program', program: 'monitoring' };
  const people = /household/.test(s) ? 'households' : /individual/.test(s) ? 'individuals' : null;
  if (people && /target/.test(t)) return { kind: 'count', field: people === 'households' ? 'householdsTarget' : 'individualsTarget' };
  if (people && /participant|actual|served|beneficiar/.test(t)) return { kind: 'count', field: people === 'households' ? 'householdsServed' : 'individualsServed' };
  if (/location|area|site/.test(t)) return { kind: 'text', field: 'site' };
  if (/funding|amount|budget/.test(t)) return { kind: 'funding' };
  if (/donor/.test(t)) return { kind: 'text', field: 'donors' };
  if (/partner|resource speaker/.test(t)) return { kind: 'text', field: 'partner' };
  if (/contact/.test(t)) return { kind: 'text', field: 'contactPerson' };
  return null;
}

const toNumber = (c: Cell): number | null => {
  if (typeof c === 'number') return Number.isFinite(c) && c >= 0 ? c : null;
  const s = clean(c);
  if (!s) return null;
  const m = s.replace(/,/g, '').match(/^\D{0,4}(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};
const toCount = (c: Cell): number | null => {
  const n = toNumber(c);
  return n === null ? null : Math.round(n);
};

const longDate = (y: number, m: number, d: number) => `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${d}, ${y}`;
const validDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/**
 * A date cell: a real date, or text as written ("February 24-25, 2026", "March 6- 15, 2026",
 * "September 26- October 2, 2026", "Sep 19-Oct 13&15,2026", "June 24-25"). The sheet's year wins
 * when the written year is missing or clearly a typo ("2027" on the 2026 sheet, "0226").
 */
export function parseDateCell(c: Cell, sheetYear: number): { start: string | null; end: string | null; label: string; warning?: string } | null {
  if (c instanceof Date) {
    let y = c.getUTCFullYear();
    const m = c.getUTCMonth() + 1;
    const d = c.getUTCDate();
    let warning: string | undefined;
    if (y !== sheetYear) {
      warning = `Date year ${y} changed to ${sheetYear} (the sheet's year)`;
      y = sheetYear;
    }
    if (!validDate(y, m, d)) return null;
    return { start: `${y}-${pad(m)}-${pad(d)}`, end: null, label: longDate(y, m, d), warning };
  }
  const text = clean(c);
  if (!text || text.toLowerCase() === 'date') return null;
  const y = sheetYear;
  const written = text.match(/(\d{4})\s*$/) ?? text.match(/\b(\d{4})\b/);
  let warning: string | undefined;
  const yearsWritten = (text.match(/\d{4}/g) ?? []).map(Number);
  if (!written) warning = `No year written; used ${sheetYear}`;
  else if (!yearsWritten.includes(sheetYear)) warning = `Year “${written[1]}” changed to ${sheetYear} (the sheet's year)`;

  let m1: number;
  let d1: number | null;
  let m2: number;
  let d2: number | null = null;
  let monthOnly = false;
  // Numbers only: "11-26 to 28,2025" (month-day, optional end day).
  const numeric = text.match(/^(\d{1,2})[-/](\d{1,2})(?:\s*(?:to|-|–)\s*(\d{1,2}))?\s*,?\s*(?:\d{4})?$/);
  if (numeric) {
    m1 = m2 = Number(numeric[1]);
    d1 = Number(numeric[2]);
    d2 = numeric[3] ? Number(numeric[3]) : null;
    if (m1 < 1 || m1 > 12) return null;
  } else {
    const monthRe = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?/gi;
    const months = [...text.matchAll(monthRe)].map((m) => ({
      month: MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3))) + 1,
      from: m.index!,
      at: m.index! + m[0].length,
    }));
    if (!months.length) return null;
    // A day after the month ("August 8"), or before it ("08-August", "22-August").
    const dayAround = (k: number) => {
      const after = text.slice(months[k].at).match(/^\s*(\d{1,2})(?!\d)/);
      if (after) return Number(after[1]);
      const before = text.slice(k ? months[k - 1].at : 0, months[k].from).match(/(?:^|\D)(\d{1,2})\s*[-\s]\s*$/);
      return before ? Number(before[1]) : null;
    };
    m1 = m2 = months[0].month;
    d1 = dayAround(0);
    // End of a range: a second month ("September 26- October 2") or a second day ("February 24-25").
    if (months.length > 1) {
      m2 = months[1].month;
      d2 = dayAround(1);
    } else if (d1) {
      const r = text.slice(months[0].at).match(/^\s*\d{1,2}\s*[-–]\s*(\d{1,2})(?!\d)/);
      if (r) d2 = Number(r[1]);
    }
    if (!d1) {
      // "August 2024-January 2025": no day at all. Dated the 1st so it sorts, and labelled as written.
      d1 = 1;
      d2 = null;
      monthOnly = true;
      warning = [warning, 'No day written; dated the 1st of the month'].filter(Boolean).join('; ');
    }
  }
  if (!validDate(y, m1, d1)) return null;
  const start = `${y}-${pad(m1)}-${pad(d1)}`;
  let end: string | null = null;
  let label = monthOnly ? text : longDate(y, m1, d1);
  if (d2 && validDate(y, m2, d2) && (m2 > m1 || (m2 === m1 && d2 > d1))) {
    end = `${y}-${pad(m2)}-${pad(d2)}`;
    label = m2 === m1 ? `${MONTHS[m1 - 1][0].toUpperCase()}${MONTHS[m1 - 1].slice(1)} ${d1}-${d2}, ${y}` : `${longDate(y, m1, d1).replace(`, ${y}`, '')} - ${longDate(y, m2, d2)}`;
  }
  return { start, end, label, warning };
}

/** Parse every year sheet of the workbook. Sheets not named as a year (e.g. "Summary") are ignored. */
export function parseWorkbook(sheets: { sheet: string; data: Cell[][] }[]): WorkbookYear[] {
  const out: WorkbookYear[] = [];
  for (const { sheet, data } of sheets) {
    const year = Number(sheet.trim());
    if (!Number.isInteger(year) || year < 2000 || year > 2100) continue;
    const headerAt = data.findIndex((r, i) => i < 15 && clean(r[0])?.toLowerCase() === 'date');
    if (headerAt < 0) continue;
    const header = data[headerAt];
    const sub = data[headerAt + 1] ?? [];
    // Merged titles ("Target Number of Participants" over Households | Individuals) carry to the right.
    const roles: (Role | null)[] = [];
    let carry = '';
    for (let c = 0; c < Math.max(header.length, sub.length); c++) {
      const title = clean(header[c]) ?? '';
      const subtitle = clean(sub[c]) ?? '';
      if (title) carry = title;
      roles.push(roleOf(title || (subtitle ? carry : ''), subtitle));
    }
    const year_: WorkbookYear = { sheet, year, rows: [], skipped: [] };
    for (let i = headerAt + 2; i < data.length; i++) {
      const r = data[i];
      const line = i + 1;
      if (!r || r.every((c) => clean(c) === null && !(c instanceof Date) && typeof c !== 'number')) continue;
      const row: Partial<WorkbookRow> & { warnings: string[] } = { warnings: [] };
      let dateCell: Cell = null;
      roles.forEach((role, c) => {
        const v = r[c] ?? null;
        if (!role) return;
        if (role.kind === 'date') dateCell = v;
        else if (role.kind === 'program') {
          const t = clean(v);
          if (t && !row.activity) {
            row.program = role.program;
            row.activity = t;
          }
        } else if (role.kind === 'count') row[role.field] = toCount(v);
        else if (role.kind === 'text') row[role.field] = clean(v);
        else if (role.kind === 'funding') {
          row.funding = toNumber(v);
          const t = clean(v);
          row.fundingNote = t && typeof v === 'string' && !/^\D{0,4}[\d,]+(\.\d+)?$/.test(t) ? t : null;
        }
      });
      if (!row.activity || !row.program) {
        year_.skipped.push({ line, sheet, reason: 'No activity written under any program' });
        continue;
      }
      // Undated rows are kept: they can still update the record they match, but can't become new records.
      const date = parseDateCell(dateCell, year);
      if (date?.warning) row.warnings.push(date.warning);
      if (!date && clean(dateCell)) row.warnings.push(`Date “${clean(dateCell)}” could not be read`);
      year_.rows.push({
        line,
        sheet,
        year,
        startDate: date?.start ?? null,
        endDate: date?.end ?? null,
        dateLabel: date?.label ?? '',
        program: row.program,
        activity: row.activity,
        site: row.site ?? null,
        householdsTarget: row.householdsTarget ?? null,
        individualsTarget: row.individualsTarget ?? null,
        householdsServed: row.householdsServed ?? null,
        individualsServed: row.individualsServed ?? null,
        funding: row.funding ?? null,
        fundingNote: row.fundingNote ?? null,
        donors: row.donors ?? null,
        partner: row.partner ?? null,
        contactPerson: row.contactPerson ?? null,
        warnings: row.warnings,
      });
    }
    out.push(year_);
  }
  return out.sort((a, b) => b.year - a.year);
}

/** Read an .xlsx file in the browser (the reader is loaded only when needed). */
export async function readWorkbookFile(file: File): Promise<WorkbookYear[]> {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = (await readXlsxFile(file)) as unknown as { sheet: string; data: Cell[][] }[];
  return parseWorkbook(sheets);
}
