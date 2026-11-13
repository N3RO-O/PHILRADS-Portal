/**
 * Our Daily Bread (Our Daily Bread Ministries): today's devotional, as on odbm.org.
 *
 * The text comes from the same feed odbm.org and the ODB app read (api.experience.odb.org). It
 * doesn't let browsers on other sites read it, so the portal asks /api/weather?devotional=<day>,
 * which fetches it, turns its HTML into plain paragraphs here (nothing from it is ever rendered as
 * HTML) and caches it for everyone. Shared by that server function, the dev server and the browser.
 *
 * The devotionals are © Our Daily Bread Ministries: shown with their name, author and a link to
 * the day's page on odbm.org.
 */

export interface OdbDevotional {
  /** Manila day, YYYY-MM-DD. */
  day: string;
  title: string;
  author: string;
  /** The key verse and its reference ("1 Peter 3:9"). */
  verse: { text: string; reference: string };
  passage: { reference: string; url: string | null };
  bibleInAYear: { reference: string; url: string | null };
  /** Today's Devotion, one string per paragraph. */
  body: string[];
  /** Reflect & Pray: the questions, then the prayer. */
  reflect: string[];
  prayer: string[];
  /** Today's Insights and who wrote them. */
  insights: string[];
  insightsAuthor: string;
  imageUrl: string | null;
  audioUrl: string | null;
  /** The day's page on odbm.org. */
  pageUrl: string;
}

const API = 'https://api.experience.odb.org/devotionals/v2';
const PAGE = 'https://www.odbm.org/en/devotionals/devotional-category/';

export const isDayKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** The feed's address for a day (it wants MM-DD-YYYY). */
export function odbApiUrl(day: string): string {
  const [y, m, d] = day.split('-');
  return `${API}?site_id=1&status=publish&country=US&on=${m}-${d}-${y}`;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '’',
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  mdash: '—',
  ndash: '–',
  hellip: '…',
};
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);

/** HTML → plain paragraphs (tags dropped, entities decoded, spaces tidied). */
export function paragraphs(html: unknown): string[] {
  if (typeof html !== 'string' || !html.trim()) return [];
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/<\/p>|<p[^>]*>|\n{2,}/i)
    .map((p) =>
      decode(p.replace(/<[^>]*>/g, ''))
        .replace(/ /g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}
const text = (html: unknown) => paragraphs(html).join(' ');

/** Only links to Bible Gateway, pictures from ODB, audio over https. */
const safeUrl = (url: unknown, host: RegExp): string | null => {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && host.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
};
const BIBLE = /^(www\.)?biblegateway\.com$/;
const ODB_MEDIA = /(^|\.)(odbm\.org|odb\.org|cloudfront\.net)$/;
const AUDIO = /(^|\.)(podtrac\.com|transistor\.fm|odbm\.org|odb\.org)$/;

/** One day from the feed, or null if it has none. */
export function parseOdb(raw: unknown, day: string): OdbDevotional | null {
  const d = (Array.isArray(raw) ? raw[0] : null) as Record<string, unknown> | null;
  if (!d || typeof d.title !== 'string') return null;
  // The key verse ends with its reference as a link: "… called. <a>1 Peter 3:9</a>".
  const verseHtml = typeof d.verse === 'string' ? d.verse : '';
  const reference = text(verseHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
  const verseText = text(verseHtml.replace(/<a[^>]*>[\s\S]*?<\/a>/gi, ''));
  const slug = typeof d.slug === 'string' && /^[a-z0-9-]+$/i.test(d.slug) ? d.slug : '';
  const body = paragraphs(d.content);
  if (!body.length) return null;
  return {
    day,
    title: text(d.title),
    author: text(d.author_name ?? d.author),
    verse: { text: verseText, reference },
    passage: { reference: text(d.passage_reference ?? d.passage), url: safeUrl(d.passage_url, BIBLE) },
    bibleInAYear: { reference: text(d.bible_in_a_year_references ?? d.bible_in_a_year), url: safeUrl(d.bible_in_a_year_url, BIBLE) },
    body,
    reflect: paragraphs(d.response),
    prayer: paragraphs(d.thought),
    insights: paragraphs(d.insights),
    insightsAuthor: text(d.insights_author_name ?? d.insights_author),
    imageUrl: safeUrl(d.image_url, ODB_MEDIA),
    audioUrl: safeUrl(d.audio_url, AUDIO),
    pageUrl: slug ? `${PAGE}${slug}` : 'https://www.odbm.org/en/devotionals',
  };
}
