import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataSource } from '../../types';
import type { ProgramKey } from '../activities/types';
import type { PlaceKind } from '../map/types';
import { fetchHazards, type HazardFeed } from './hazards';

// ───────────────────────── Shapes ─────────────────────────

/** An activity site on the guest map: where, what and how many were served. Nothing private. */
export interface GuestSite {
  id: string;
  year: number;
  program: ProgramKey;
  response: string | null;
  activity: string;
  site: string;
  lat: number;
  lng: number;
  dateLabel: string;
  startDate: string | null;
  households: number | null;
  individuals: number | null;
  status: 'completed' | 'ongoing' | 'scheduled';
}

export interface GuestPlace {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  address: string | null;
}

export interface GuestOverview {
  sites: GuestSite[];
  places: GuestPlace[];
  totals: { activities: number; individuals: number; households: number; places: number; since: number | null };
}

export type StoryKind = 'story' | 'update' | 'reflection';
export const STORY_KINDS: { key: StoryKind; label: string }[] = [
  { key: 'story', label: 'Story' },
  { key: 'update', label: 'Field update' },
  { key: 'reflection', label: 'Reflection' },
];

export interface GuestStory {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  kind: StoryKind;
  place: string | null;
  coverUrl: string | null;
  authorName: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
}
export type StoryDraft = Omit<GuestStory, 'id' | 'publishedAt' | 'updatedAt'> & { id?: string };

export type AnnouncementLevel = 'update' | 'advisory' | 'urgent';
export const ANNOUNCEMENT_LEVELS: { key: AnnouncementLevel; label: string; note: string }[] = [
  { key: 'update', label: 'Update', note: 'News from PHILRADS: a site opening, relief being handed out.' },
  { key: 'advisory', label: 'Advisory', note: 'Something people in an area should know or prepare for.' },
  { key: 'urgent', label: 'Urgent', note: 'Act now. Shown first, in red.' },
];
export const announcementLevelLabel = (k: AnnouncementLevel) => ANNOUNCEMENT_LEVELS.find((l) => l.key === k)?.label ?? k;

/** PHILRADS's own post at the top of Disaster News. */
export interface GuestAnnouncement {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  area: string | null;
  linkUrl: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  /** Off the guest page after this moment; null keeps it up until unpublished. */
  expiresAt: string | null;
  updatedAt: string;
}
export type AnnouncementDraft = Omit<GuestAnnouncement, 'id' | 'publishedAt' | 'updatedAt'> & { id?: string };

/** Live on the guest page right now: published and not past its time. */
export const isLive = (a: GuestAnnouncement, now = Date.now()) => a.isPublished && (!a.expiresAt || Date.parse(a.expiresAt) > now);
const LEVEL_ORDER: Record<AnnouncementLevel, number> = { urgent: 0, advisory: 1, update: 2 };
/** Urgent first, then advisories, then updates; newest first within each. */
export const byImportance = (a: GuestAnnouncement, b: GuestAnnouncement) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');

export type DriveStatus = 'draft' | 'open' | 'closed';
export interface DonationDrive {
  id: string;
  title: string;
  summary: string | null;
  impactNote: string | null;
  unit: string;
  goal: number;
  raised: number;
  donorCount: number | null;
  startsOn: string | null;
  endsOn: string | null;
  howToGive: string | null;
  coverUrl: string | null;
  status: DriveStatus;
  raisedUpdatedAt: string | null;
}
export type DriveDraft = Omit<DonationDrive, 'id' | 'raisedUpdatedAt'> & { id?: string };

export interface MerchItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  sizes: string[];
  imageUrl: string | null;
  inStock: boolean;
  isListed: boolean;
  sortOrder: number;
}
export type MerchDraft = Omit<MerchItem, 'id'> & { id?: string };

export type MessageKind = 'thanks' | 'suggestion' | 'need' | 'concern' | 'order' | 'volunteer';
export const MESSAGE_KINDS: { key: MessageKind; label: string }[] = [
  { key: 'thanks', label: 'Thanks' },
  { key: 'suggestion', label: 'Suggestion' },
  { key: 'need', label: 'Community need' },
  { key: 'concern', label: 'Concern' },
  { key: 'order', label: 'Merch order' },
  { key: 'volunteer', label: 'Volunteering' },
];
export const messageKindLabel = (k: string) => MESSAGE_KINDS.find((m) => m.key === k)?.label ?? k;

export interface GuestMessageDraft {
  kind: MessageKind;
  message: string;
  rating?: number | null;
  community?: string;
  name?: string;
  contact?: string;
  merchId?: string;
  merchSize?: string;
  quantity?: number;
}

export type MessageStatus = 'new' | 'seen' | 'done';
export interface GuestMessage {
  id: string;
  kind: MessageKind;
  message: string;
  rating: number | null;
  community: string | null;
  name: string | null;
  contact: string | null;
  merchName: string | null;
  merchSize: string | null;
  quantity: number | null;
  status: MessageStatus;
  handledBy: string | null;
  createdAt: string;
}

export const MESSAGE_MAX = 2000;
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;

export class GuestRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuestRuleError';
  }
}

export interface GuestService {
  readonly source: DataSource;
  // What guests see.
  overview(): Promise<GuestOverview>;
  stories(): Promise<GuestStory[]>;
  announcements(): Promise<GuestAnnouncement[]>;
  drives(): Promise<DonationDrive[]>;
  merch(): Promise<MerchItem[]>;
  send(draft: GuestMessageDraft): Promise<void>;
  hazards(signal?: AbortSignal): Promise<HazardFeed>;
  // Staff with guest.manage.
  allStories(): Promise<GuestStory[]>;
  saveStory(d: StoryDraft): Promise<GuestStory>;
  removeStory(id: string): Promise<void>;
  allAnnouncements(): Promise<GuestAnnouncement[]>;
  saveAnnouncement(d: AnnouncementDraft): Promise<GuestAnnouncement>;
  removeAnnouncement(id: string): Promise<void>;
  allDrives(): Promise<DonationDrive[]>;
  saveDrive(d: DriveDraft): Promise<DonationDrive>;
  removeDrive(id: string): Promise<void>;
  allMerch(): Promise<MerchItem[]>;
  saveMerch(d: MerchDraft): Promise<MerchItem>;
  removeMerch(id: string): Promise<void>;
  inbox(): Promise<GuestMessage[]>;
  markMessage(id: string, status: MessageStatus): Promise<void>;
  removeMessage(id: string): Promise<void>;
  /** A picture for a story, drive or item: returns its public address. */
  uploadImage(file: File): Promise<string>;
}

/** Days left in a drive (0 on its last day), or null without an end date / once ended. */
export function daysLeft(endsOn: string | null, today = new Date()) {
  if (!endsOn) return null;
  const end = Date.parse(`${endsOn}T23:59:59+08:00`);
  const left = Math.floor((end - today.getTime()) / 86_400_000);
  return left < 0 ? null : left;
}

export const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
export const amount = (n: number, unit: string) => (unit.toUpperCase() === 'PHP' ? peso(n) : `${Math.round(n).toLocaleString('en-PH')} ${unit}`);

/** The page's hazards: the shared copy first, the sources directly if that fails. */
async function loadHazards(signal?: AbortSignal): Promise<HazardFeed> {
  if (!import.meta.env.DEV) {
    try {
      const res = await fetch('/api/weather?hazards=ph', { signal });
      if (res.ok) return (await res.json()) as HazardFeed;
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
  }
  const feed = await fetchHazards(fetch, signal);
  if (feed.missing.length === 2) throw new Error('Disaster news is unreachable right now. Check the official sources below.');
  return feed;
}

function checkImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new GuestRuleError('Choose a JPG, PNG or WebP picture.');
  if (file.size > IMAGE_MAX_BYTES) throw new GuestRuleError('Choose a picture under 3 MB.');
}

function checkAnnouncement(d: AnnouncementDraft) {
  if (!d.title.trim()) throw new GuestRuleError('Give the announcement a title.');
  if (d.linkUrl && !/^https:\/\/\S+$/.test(d.linkUrl.trim())) throw new GuestRuleError('The link has to start with https://');
}

function checkMessage(d: GuestMessageDraft) {
  const msg = d.message.trim();
  if (msg.length < 2) throw new GuestRuleError('Write a message first.');
  if (msg.length > MESSAGE_MAX) throw new GuestRuleError('Keep the message under 2,000 characters.');
  if ((d.kind === 'order' || d.kind === 'volunteer') && (d.contact ?? '').trim().length < 5) throw new GuestRuleError('Add a phone number or email so we can reply.');
}

// ───────────────────────── Sample data ─────────────────────────

const KEY = 'philrads.sample.guest.v1';
const isoDaysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

interface SampleStore {
  stories: GuestStory[];
  announcements: GuestAnnouncement[];
  drives: DonationDrive[];
  merch: MerchItem[];
  messages: GuestMessage[];
}

function seed(): SampleStore {
  return {
    announcements: [
      {
        id: 'an1',
        title: 'Relief packs at Virac covered court, Saturday 8 AM (sample)',
        body: 'Families in Brgy. Sample who signed up last week can collect their packs. Bring the family card the team gave you.',
        level: 'update',
        area: 'Virac, Catanduanes',
        linkUrl: null,
        isPublished: true,
        publishedAt: ago(0.5),
        expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        updatedAt: ago(0.5),
      },
    ],
    stories: [
      {
        id: 'st1',
        title: 'Three days in Virac after the typhoon',
        summary: 'How a church hall became a packing line, and what families asked for first.',
        body:
          'The road into Virac opened on the second morning. By then the church hall at the edge of town had already turned into a packing line: rice at one table, canned goods at the next, water kits by the door.\n\nWe asked families what they needed most. The answer was almost always the same: clean water first, then something to cook with. So the kits changed on the second day. Fewer noodles, more water containers and purification tablets.\n\nBy the third day 350 households had a family food pack and a water kit. Volunteers from the parish walked the packs to the homes of older people who could not queue.\n\nThis is sample text for the demo. Staff write the real stories from the Guest page editor.',
        kind: 'story',
        place: 'Virac, Catanduanes',
        coverUrl: null,
        authorName: 'PHILRADS field team',
        isPublished: true,
        publishedAt: ago(9),
        updatedAt: ago(9),
      },
      {
        id: 'st2',
        title: 'Why we train church volunteers in psychological first aid',
        summary: 'After the food packs are gone, people still carry what they lived through.',
        body:
          'Relief goods run out in days. Fear and grief take longer. That is why every response now includes a few hours of psychological first aid training for the local volunteers who will stay long after we leave.\n\nIn Tacloban, 45 volunteers learned how to listen without fixing, how to notice when someone needs more help, and where to send them.\n\nThis is sample text for the demo.',
        kind: 'reflection',
        place: 'Tacloban City',
        coverUrl: null,
        authorName: 'PHILRADS training team',
        isPublished: true,
        publishedAt: ago(28),
        updatedAt: ago(28),
      },
      {
        id: 'st3',
        title: 'Field update: water kits reach Glan',
        summary: 'Community feeding continues for 120 children.',
        body: 'Feeding sessions for children continue in Glan, Sarangani, three times a week. This is sample text for the demo.',
        kind: 'update',
        place: 'Glan, Sarangani',
        coverUrl: null,
        authorName: null,
        isPublished: true,
        publishedAt: ago(41),
        updatedAt: ago(41),
      },
    ],
    drives: [
      {
        id: 'dr1',
        title: 'Family food packs for Catanduanes',
        summary: 'Rice, canned goods, cooking oil and water for families whose homes were hit by the typhoon.',
        impactNote: '₱650 packs food for a family of five for three days.',
        unit: 'PHP',
        goal: 500000,
        raised: 318400,
        donorCount: 214,
        startsOn: isoDaysFromNow(-12),
        endsOn: isoDaysFromNow(18),
        howToGive: 'GCash: 0917 000 0000 (sample)\nBank transfer: Sample Bank, account 0000-0000-00 (sample)\nPlease add "Catanduanes" to the note so your gift goes to this drive.',
        coverUrl: null,
        status: 'open',
        raisedUpdatedAt: ago(1),
      },
      {
        id: 'dr2',
        title: 'School kits before classes reopen',
        summary: 'Bags, notebooks and pencils for children in evacuation centres.',
        impactNote: 'One kit is one child ready for school.',
        unit: 'kits',
        goal: 800,
        raised: 236,
        donorCount: null,
        startsOn: isoDaysFromNow(-5),
        endsOn: isoDaysFromNow(40),
        howToGive: 'Drop off new school supplies at the PHILRADS office, Monday to Friday, 9 am to 5 pm (sample).',
        coverUrl: null,
        status: 'open',
        raisedUpdatedAt: ago(3),
      },
      {
        id: 'dr3',
        title: 'Shelter repair in San Mateo',
        summary: 'Roofing sheets and tools for families after the flood.',
        impactNote: null,
        unit: 'PHP',
        goal: 320000,
        raised: 320000,
        donorCount: 96,
        startsOn: '2024-09-01',
        endsOn: '2024-10-15',
        howToGive: null,
        coverUrl: null,
        status: 'closed',
        raisedUpdatedAt: '2024-10-15T08:00:00Z',
      },
    ],
    merch: [
      { id: 'm1', name: 'PHILRADS shirt', description: 'Soft cotton shirt with the PHILRADS mark. Every shirt helps pay for relief packs.', price: 450, sizes: ['S', 'M', 'L', 'XL', '2XL'], imageUrl: null, inStock: true, isListed: true, sortOrder: 0 },
      { id: 'm2', name: 'Volunteer cap', description: 'The cap our volunteers wear in the field.', price: 300, sizes: [], imageUrl: null, inStock: true, isListed: true, sortOrder: 1 },
      { id: 'm3', name: 'Tumbler', description: 'Keeps water cold for a full day out.', price: 550, sizes: [], imageUrl: null, inStock: false, isListed: true, sortOrder: 2 },
      { id: 'm4', name: 'Tote bag', description: 'Canvas bag, printed by a livelihood group we support.', price: 250, sizes: [], imageUrl: null, inStock: true, isListed: true, sortOrder: 3 },
    ],
    messages: [
      { id: 'g1', kind: 'need', message: 'Our barangay still has no clean water after the flood. About 60 families. (sample)', rating: null, community: 'Brgy. Sample, Rizal', name: 'Ana', contact: '0917 000 0001', merchName: null, merchSize: null, quantity: null, status: 'new', handledBy: null, createdAt: ago(0.2) },
      { id: 'g2', kind: 'thanks', message: 'Thank you for the food packs last week. (sample)', rating: 5, community: 'Virac', name: null, contact: null, merchName: null, merchSize: null, quantity: null, status: 'seen', handledBy: null, createdAt: ago(2) },
    ],
  };
}

function load(): SampleStore {
  try {
    const raw = localStorage.getItem(KEY);
    // Sample data saved before announcements existed gets the sample ones added.
    if (raw) return { announcements: seed().announcements, ...(JSON.parse(raw) as Partial<SampleStore>) } as SampleStore;
  } catch {
    /* fall through to the sample */
  }
  return seed();
}
function save(s: SampleStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sample mode: keep going in memory */
  }
}
const wait = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));
const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
const upsert = <T extends { id: string }>(list: T[], item: T) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.unshift(item);
};

export function createMockGuestService(overview: () => Promise<GuestOverview>): GuestService {
  let store = load();
  const commit = () => save(store);
  return {
    source: 'mock',
    overview,
    stories: () => wait(store.stories.filter((s) => s.isPublished).sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))),
    announcements: () => wait(store.announcements.filter((a) => isLive(a)).sort(byImportance)),
    drives: () => wait(store.drives.filter((d) => d.status !== 'draft')),
    merch: () => wait(store.merch.filter((m) => m.isListed).sort((a, b) => a.sortOrder - b.sortOrder)),
    async send(d) {
      checkMessage(d);
      const item = d.merchId ? store.merch.find((m) => m.id === d.merchId) : null;
      store.messages.unshift({
        id: newId(),
        kind: d.kind,
        message: d.message.trim(),
        rating: d.rating ?? null,
        community: d.community?.trim() || null,
        name: d.name?.trim() || null,
        contact: d.contact?.trim() || null,
        merchName: item?.name ?? null,
        merchSize: d.merchSize || null,
        quantity: d.kind === 'order' ? d.quantity ?? 1 : null,
        status: 'new',
        handledBy: null,
        createdAt: new Date().toISOString(),
      });
      commit();
      await wait(null, 500);
    },
    hazards: loadHazards,
    allStories: () => wait(store.stories),
    async saveStory(d) {
      const prev = d.id ? store.stories.find((s) => s.id === d.id) : undefined;
      const now = new Date().toISOString();
      const story: GuestStory = { ...d, id: d.id ?? newId(), publishedAt: prev?.publishedAt ?? (d.isPublished ? now : null), updatedAt: now };
      if (story.isPublished && !story.publishedAt) story.publishedAt = now;
      upsert(store.stories, story);
      commit();
      return wait(story);
    },
    async removeStory(id) {
      store.stories = store.stories.filter((s) => s.id !== id);
      commit();
    },
    allAnnouncements: () => wait([...store.announcements].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
    async saveAnnouncement(d) {
      checkAnnouncement(d);
      const prev = d.id ? store.announcements.find((a) => a.id === d.id) : undefined;
      const now = new Date().toISOString();
      const a: GuestAnnouncement = { ...d, id: d.id ?? newId(), publishedAt: prev?.publishedAt ?? (d.isPublished ? now : null), updatedAt: now };
      upsert(store.announcements, a);
      commit();
      return wait(a);
    },
    async removeAnnouncement(id) {
      store.announcements = store.announcements.filter((a) => a.id !== id);
      commit();
    },
    allDrives: () => wait(store.drives),
    async saveDrive(d) {
      const prev = d.id ? store.drives.find((x) => x.id === d.id) : undefined;
      const moved = !prev || prev.raised !== d.raised || prev.donorCount !== d.donorCount;
      const drive: DonationDrive = { ...d, id: d.id ?? newId(), raisedUpdatedAt: moved ? new Date().toISOString() : prev!.raisedUpdatedAt };
      upsert(store.drives, drive);
      commit();
      return wait(drive);
    },
    async removeDrive(id) {
      store.drives = store.drives.filter((s) => s.id !== id);
      commit();
    },
    allMerch: () => wait([...store.merch].sort((a, b) => a.sortOrder - b.sortOrder)),
    async saveMerch(d) {
      const item: MerchItem = { ...d, id: d.id ?? newId() };
      upsert(store.merch, item);
      commit();
      return wait(item);
    },
    async removeMerch(id) {
      store.merch = store.merch.filter((s) => s.id !== id);
      commit();
    },
    inbox: () => wait(store.messages),
    async markMessage(id, status) {
      store.messages = store.messages.map((m) => (m.id === id ? { ...m, status } : m));
      commit();
    },
    async removeMessage(id) {
      store.messages = store.messages.filter((m) => m.id !== id);
      commit();
    },
    async uploadImage(file) {
      checkImage(file);
      // Sample mode: a small copy kept on this device.
      const url = await shrink(file, 900);
      return url;
    },
  };
}

/** A smaller JPEG data URL of the picture (sample mode only). */
function shrink(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new GuestRuleError('That picture could not be read.'));
    img.src = URL.createObjectURL(file);
  });
}

// ───────────────────────── Supabase ─────────────────────────

type Row = Record<string, unknown>;
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const s = (v: unknown) => (v === null || v === undefined ? null : String(v));

const toStory = (r: Row): GuestStory => ({
  id: String(r.id),
  title: String(r.title),
  summary: s(r.summary),
  body: String(r.body ?? ''),
  kind: r.kind as StoryKind,
  place: s(r.place),
  coverUrl: s(r.cover_url),
  authorName: s(r.author_name),
  isPublished: Boolean(r.is_published),
  publishedAt: s(r.published_at),
  updatedAt: String(r.updated_at),
});
const fromStory = (d: StoryDraft) => ({
  title: d.title.trim(),
  summary: d.summary?.trim() || null,
  body: d.body,
  kind: d.kind,
  place: d.place?.trim() || null,
  cover_url: d.coverUrl || null,
  author_name: d.authorName?.trim() || null,
  is_published: d.isPublished,
});
const toAnnouncement = (r: Row): GuestAnnouncement => ({
  id: String(r.id),
  title: String(r.title),
  body: String(r.body ?? ''),
  level: r.level as AnnouncementLevel,
  area: s(r.area),
  linkUrl: s(r.link_url),
  isPublished: Boolean(r.is_published),
  publishedAt: s(r.published_at),
  expiresAt: s(r.expires_at),
  updatedAt: String(r.updated_at),
});
const fromAnnouncement = (d: AnnouncementDraft) => ({
  title: d.title.trim(),
  body: d.body.trim(),
  level: d.level,
  area: d.area?.trim() || null,
  link_url: d.linkUrl?.trim() || null,
  is_published: d.isPublished,
  expires_at: d.expiresAt || null,
});
const toDrive = (r: Row): DonationDrive => ({
  id: String(r.id),
  title: String(r.title),
  summary: s(r.summary),
  impactNote: s(r.impact_note),
  unit: String(r.unit ?? 'PHP'),
  goal: Number(r.goal),
  raised: Number(r.raised),
  donorCount: n(r.donor_count),
  startsOn: s(r.starts_on),
  endsOn: s(r.ends_on),
  howToGive: s(r.how_to_give),
  coverUrl: s(r.cover_url),
  status: r.status as DriveStatus,
  raisedUpdatedAt: s(r.raised_updated_at),
});
const fromDrive = (d: DriveDraft) => ({
  title: d.title.trim(),
  summary: d.summary?.trim() || null,
  impact_note: d.impactNote?.trim() || null,
  unit: d.unit.trim() || 'PHP',
  goal: d.goal,
  raised: d.raised,
  donor_count: d.donorCount,
  starts_on: d.startsOn || null,
  ends_on: d.endsOn || null,
  how_to_give: d.howToGive?.trim() || null,
  cover_url: d.coverUrl || null,
  status: d.status,
});
const toMerch = (r: Row): MerchItem => ({
  id: String(r.id),
  name: String(r.name),
  description: s(r.description),
  price: n(r.price),
  sizes: (r.sizes as string[] | null) ?? [],
  imageUrl: s(r.image_url),
  inStock: Boolean(r.in_stock),
  isListed: Boolean(r.is_listed),
  sortOrder: Number(r.sort_order ?? 0),
});
const fromMerch = (d: MerchDraft) => ({
  name: d.name.trim(),
  description: d.description?.trim() || null,
  price: d.price,
  sizes: d.sizes.map((x) => x.trim()).filter(Boolean),
  image_url: d.imageUrl || null,
  in_stock: d.inStock,
  is_listed: d.isListed,
  sort_order: d.sortOrder,
});

/** The database's own words for a broken rule (raised by submit_guest_message), or a plain fallback. */
function fail(scope: string, error: { message?: string; code?: string }, fallback: string): never {
  console.error(`[guest] ${scope}`, error);
  if (error.code === '22023' || error.code === '54000') throw new GuestRuleError(error.message ?? fallback);
  if (error.code === '42501') throw new GuestRuleError('Only coordinators and administrators can change the guest pages.');
  throw new Error(fallback);
}

export function createSupabaseGuestService(client: SupabaseClient): GuestService {
  const list = async <T,>(table: string, map: (r: Row) => T, build: (q: ReturnType<SupabaseClient['from']>) => PromiseLike<{ data: unknown; error: unknown }>, what: string) => {
    const { data, error } = await build(client.from(table));
    if (error) fail(`list ${table}`, error as { message?: string }, `Could not load ${what}. Check the connection and try again.`);
    return ((data as Row[] | null) ?? []).map(map);
  };
  const saveRow = async <T,>(table: string, id: string | undefined, row: Row, map: (r: Row) => T, what: string) => {
    const q = id ? client.from(table).update(row).eq('id', id) : client.from(table).insert(row);
    const { data, error } = await q.select('*').single();
    if (error) fail(`save ${table}`, error, `Could not save the ${what}. Check the connection and try again.`);
    return map(data as Row);
  };
  const removeRow = async (table: string, id: string, what: string) => {
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) fail(`remove ${table}`, error, `Could not delete the ${what}. Check the connection and try again.`);
  };
  return {
    source: 'supabase',
    async overview() {
      const { data, error } = await client.rpc('guest_overview');
      if (error) fail('overview', error, 'Could not load the map. Check the connection and try again.');
      const o = (data ?? {}) as Partial<GuestOverview>;
      return {
        sites: (o.sites ?? []).map((x) => ({ ...x, lat: Number(x.lat), lng: Number(x.lng), households: n(x.households), individuals: n(x.individuals) })),
        places: (o.places ?? []).map((x) => ({ ...x, lat: Number(x.lat), lng: Number(x.lng) })),
        totals: {
          activities: Number(o.totals?.activities ?? 0),
          individuals: Number(o.totals?.individuals ?? 0),
          households: Number(o.totals?.households ?? 0),
          places: Number(o.totals?.places ?? 0),
          since: n(o.totals?.since),
        },
      };
    },
    stories: () => list('guest_stories', toStory, (q) => q.select('*').eq('is_published', true).order('published_at', { ascending: false }).limit(60), 'the stories'),
    async announcements() {
      // The database hides expired ones too; sorting by level happens here.
      const rows = await list('guest_announcements', toAnnouncement, (q) => q.select('*').eq('is_published', true).order('published_at', { ascending: false }).limit(30), 'the announcements');
      return rows.filter((a) => isLive(a)).sort(byImportance);
    },
    drives: () => list('donation_drives', toDrive, (q) => q.select('*').in('status', ['open', 'closed']).order('ends_on', { ascending: false, nullsFirst: true }).limit(40), 'the donation drives'),
    merch: () => list('merch_items', toMerch, (q) => q.select('*').eq('is_listed', true).order('sort_order').limit(60), 'the merch'),
    async send(d) {
      checkMessage(d);
      const { error } = await client.rpc('submit_guest_message', {
        p_kind: d.kind,
        p_message: d.message.trim(),
        p_rating: d.rating ?? null,
        p_community: d.community?.trim() || null,
        p_name: d.name?.trim() || null,
        p_contact: d.contact?.trim() || null,
        p_merch_id: d.merchId ?? null,
        p_merch_size: d.merchSize || null,
        p_quantity: d.quantity ?? null,
      });
      if (error) fail('send', error, 'Your message could not be sent. Check the connection and try again.');
    },
    hazards: loadHazards,
    allStories: () => list('guest_stories', toStory, (q) => q.select('*').order('updated_at', { ascending: false }).limit(200), 'the stories'),
    saveStory: (d) => saveRow('guest_stories', d.id, fromStory(d), toStory, 'story'),
    removeStory: (id) => removeRow('guest_stories', id, 'story'),
    allAnnouncements: () => list('guest_announcements', toAnnouncement, (q) => q.select('*').order('updated_at', { ascending: false }).limit(200), 'the announcements'),
    saveAnnouncement: (d) => {
      checkAnnouncement(d);
      return saveRow('guest_announcements', d.id, fromAnnouncement(d), toAnnouncement, 'announcement');
    },
    removeAnnouncement: (id) => removeRow('guest_announcements', id, 'announcement'),
    allDrives: () => list('donation_drives', toDrive, (q) => q.select('*').order('created_at', { ascending: false }).limit(200), 'the donation drives'),
    saveDrive: (d) => saveRow('donation_drives', d.id, fromDrive(d), toDrive, 'drive'),
    removeDrive: (id) => removeRow('donation_drives', id, 'drive'),
    allMerch: () => list('merch_items', toMerch, (q) => q.select('*').order('sort_order').limit(200), 'the merch'),
    saveMerch: (d) => saveRow('merch_items', d.id, fromMerch(d), toMerch, 'item'),
    removeMerch: (id) => removeRow('merch_items', id, 'item'),
    inbox: () =>
      list(
        'guest_messages',
        (r): GuestMessage => ({
          id: String(r.id),
          kind: r.kind as MessageKind,
          message: String(r.message),
          rating: n(r.rating),
          community: s(r.community),
          name: s(r.name),
          contact: s(r.contact),
          merchName: s((r.merch as Row | null)?.name),
          merchSize: s(r.merch_size),
          quantity: n(r.quantity),
          status: r.status as MessageStatus,
          handledBy: s((r.handler as Row | null)?.full_name),
          createdAt: String(r.created_at),
        }),
        (q) =>
          q
            .select('id, kind, message, rating, community, name, contact, merch_size, quantity, status, created_at, merch:merch_items(name), handler:profiles!guest_messages_handled_by_fkey(full_name)')
            .order('created_at', { ascending: false })
            .limit(300),
        'the messages',
      ),
    async markMessage(id, status) {
      const { data: me } = await client.auth.getUser();
      const { error } = await client
        .from('guest_messages')
        .update({ status, handled_by: status === 'new' ? null : me.user?.id ?? null, handled_at: status === 'new' ? null : new Date().toISOString() })
        .eq('id', id);
      if (error) fail('mark', error, 'Could not update the message. Check the connection and try again.');
    },
    removeMessage: (id) => removeRow('guest_messages', id, 'message'),
    async uploadImage(file) {
      checkImage(file);
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${new Date().toISOString().slice(0, 7)}/${newId()}.${ext}`;
      const { error } = await client.storage.from('guest-media').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
      if (error) {
        console.error('[guest] upload', error);
        throw new Error('The picture could not be uploaded. Check the connection and try again.');
      }
      return client.storage.from('guest-media').getPublicUrl(path).data.publicUrl;
    },
  };
}
