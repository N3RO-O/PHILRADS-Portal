/**
 * Top donors from the activity records. Donors are written free-form ("101 Foundation, Union Church
 * of Manila & individual donors", "101 Fdtn & FEBC -Pubsol", "ALL-INCLUSIVE SALES AND 101 FOUNDATION"),
 * so each entry is split into names and spellings of the same donor are counted together.
 */
import type { ProgramActivity } from '../services/activities/types';

/** Spellings that mean the same donor. Keys are compared after lower-casing and removing punctuation. */
const ALIASES: [RegExp, string][] = [
  [/^101( foundation| fdtn| fdn)?$/, '101 Foundation'],
  [/^all ?inclusives? sales?$/, 'All-Inclusive Sales'],
  [/^omf( international)?$/, 'OMF International'],
  [/^insular life( foundation)?$/, 'Insular Life Foundation'],
  [/^start( network| fund| ready)*$/, 'START Network'],
  [/^(febc )?pubsol$/, 'PUBSOL'],
  [/^tearfund$/, 'Tearfund'],
  [/^hi$|^humanity (and|&) inclusion$/, 'Humanity & Inclusion'],
  [/^ri$|^relief international$/, 'Relief International'],
  [/^umc$|^united methodist church$/, 'UMC'],
];
/** Not a named donor (or PHILRADS itself). */
const SKIP = /^(individual|multiple|mutiple|private|anonymous|other)\b.*donors?$|^individuals?$|^others?$|^philrads$|^consortium$|^n ?a$|^none$/;

const keyOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The names in one donors entry, with spellings unified. */
export function splitDonors(text: string | null): string[] {
  if (!text) return [];
  const names = text
    .replace(/humanity\s*(&|and)\s*inclusion/gi, 'HI') // keep the name whole when splitting on "&"
    .replace(/\([^)]*\)/g, ' ') // "(NCCP + Caritas + PHILRADS)"
    .split(/[,;&/+]|\band\b|\.\s/i)
    .map((p) => (p.includes(':') ? p.slice(p.lastIndexOf(':') + 1) : p)) // "Consortium: World Vision"
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const n of names) {
    const k = keyOf(n);
    if (!k || SKIP.test(k)) continue;
    const alias = ALIASES.find(([re]) => re.test(k));
    // "ALL-INCLUSIVE SALES" reads better as "All-Inclusive Sales"; one-word acronyms (FEBC, SPUP) stay as they are.
    const shouting = n === n.toUpperCase() && /[A-Z]/.test(n) && n.includes(' ');
    const name = alias ? alias[1] : shouting ? n.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase()) : n;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

export interface DonorTotal {
  name: string;
  /** Activities the donor supported. */
  activities: number;
  /**
   * The donor's share of the funding recorded for those activities. Records give one amount per
   * activity, so where several donors are named it is split evenly between them (an estimate).
   */
  funding: number;
  /** Activities among them with a funding amount. */
  funded: number;
  /** Activities supported only by this donor (no co-donor named). */
  sole: number;
  latest: string;
}

/** Donors ranked by funding of the activities they supported, then by number of activities. */
export function topDonors(list: ProgramActivity[], by: 'funding' | 'activities' = 'funding'): DonorTotal[] {
  const m = new Map<string, DonorTotal>();
  for (const a of list) {
    const names = splitDonors(a.donors);
    for (const name of names) {
      const key = keyOf(name);
      const t = m.get(key) ?? { name, activities: 0, funding: 0, funded: 0, sole: 0, latest: '' };
      t.activities++;
      if (a.funding !== null) {
        t.funding += a.funding / names.length;
        t.funded++;
      }
      if (names.length === 1) t.sole++;
      const when = a.startDate ?? `${a.year}`;
      if (when > t.latest) t.latest = when;
      // Prefer a spelling that isn't all capitals.
      if (t.name === t.name.toUpperCase() && name !== name.toUpperCase()) t.name = name;
      m.set(key, t);
    }
  }
  return [...m.values()].sort((x, y) => (by === 'funding' ? y.funding - x.funding || y.activities - x.activities : y.activities - x.activities || y.funding - x.funding) || x.name.localeCompare(y.name));
}
