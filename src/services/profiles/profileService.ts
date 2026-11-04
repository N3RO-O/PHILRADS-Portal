import type { SupabaseClient } from '@supabase/supabase-js';
import { demoProfile } from '../../data/mockDashboard';
import { initialsOf } from '../../lib/format';
import { computeProgress, type TaskStats } from '../../lib/taskProgress';
import type { DataSource } from '../../types';
import { mockTasksService } from '../tasks/tasksService';

/**
 * Profiles: who someone is on the team (position, phone, a short bio, a picture). Colleagues can
 * see them; only the person (or a staff administrator) can change theirs
 * (supabase/migrations/20261028000400_projects_people_and_drive_deletes.sql).
 */

export interface PersonProfile {
  id: string;
  fullName: string;
  displayName: string;
  initials: string;
  roleName: string | null;
  office: string | null;
  jobTitle: string | null;
  phone: string | null;
  bio: string | null;
  avatar: string | null;
  avatarColor: string | null;
  /** Animated frame around the picture (src/lib/avatarFrames.ts). */
  avatarFrame: string | null;
  isActive: boolean;
  /** When the account was made. */
  memberSince: string | null;
  /** Public: colleagues see the whole profile. Private: only name, picture and role. */
  isPublic: boolean;
  /** False when this is someone else's private profile: the details and badges are hidden. */
  details: boolean;
}

export interface ProfilePicture {
  avatar: string | null;
  color: string | null;
  frame?: string | null;
}

/** What someone's level and badges are worked out from (src/lib/taskProgress.ts). */
export interface ProfileProgress {
  xp: number;
  stats: TaskStats;
}

export interface ProfilePatch {
  fullName: string;
  displayName: string;
  jobTitle: string;
  phone: string;
  bio: string;
  avatar: string | null;
  avatarColor: string | null;
  avatarFrame: string | null;
  isPublic: boolean;
}

/** Colours for the initials badge. */
export const AVATAR_COLORS = ['#8a2432', '#b4541d', '#ec952a', '#3f8f5b', '#2f7f8f', '#3c5fa8', '#6a4aa0', '#a03f7a'];

export class ProfileRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileRuleError';
  }
}

export interface ProfileService {
  readonly source: DataSource;
  get(id: string): Promise<PersonProfile | null>;
  /** Level and badges: anyone on the team can see them. */
  progress(id: string): Promise<ProfileProgress | null>;
  /** Pictures and colours for several people at once (team lists, logs). */
  pictures(ids: string[]): Promise<Record<string, ProfilePicture>>;
  /** Your own profile. */
  save(id: string, patch: ProfilePatch): Promise<void>;
}

const validate = (p: ProfilePatch) => {
  if (!p.displayName.trim()) throw new ProfileRuleError('Your name on the portal can’t be empty.');
  if (p.bio.length > 500) throw new ProfileRuleError('Keep your bio to 500 characters.');
  if (p.phone.trim() && !/^[0-9+() .-]{5,30}$/.test(p.phone.trim())) throw new ProfileRuleError('Use digits, spaces and + ( ) - only for the phone number.');
};

/** Open a photo from the phone or computer, ready to position (PhotoCropper). */
export function openPicture(file: File): Promise<HTMLImageElement> {
  if (!file.type.startsWith('image/')) return Promise.reject(new ProfileRuleError('Choose a photo (JPG, PNG or similar).'));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ProfileRuleError('That photo couldn’t be opened. Try a JPG or PNG.'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * The chosen square of a photo (x, y, side in the photo's pixels) as a small JPEG (256 px),
 * so it loads fast everywhere and fits in the profile.
 */
export function cropPicture(img: HTMLImageElement, x: number, y: number, side: number, size = 256): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x, y, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}

// ───────────────────────── Supabase ─────────────────────────

/** The column isn't there (a database that hasn't had a migration yet). */
const missingColumn = (e: { code?: string; message?: string }) => e.code === '42703' || e.code === 'PGRST204' || /avatar_frame/.test(e.message ?? '');

export function createSupabaseProfileService(client: SupabaseClient): ProfileService {
  return {
    source: 'supabase',
    async get(id) {
      // view_profile leaves the details out of someone else's private profile (the database decides).
      const { data: raw, error } = await client.rpc('view_profile', { p_id: id });
      if (error) throw new Error('This profile could not be loaded. Check the connection and try again.');
      const data = raw as Record<string, unknown> | null;
      if (!data) return null;
      const displayName = ((data.display_name as string) || (data.full_name as string) || 'Staff member').trim();
      return {
        id: data.id as string,
        fullName: ((data.full_name as string) || displayName).trim(),
        displayName,
        initials: initialsOf(displayName),
        roleName: (data.role_name as string | null) ?? null,
        office: (data.office as string | null) ?? null,
        jobTitle: (data.job_title as string | null) ?? null,
        phone: (data.phone as string | null) ?? null,
        bio: (data.bio as string | null) ?? null,
        avatar: (data.avatar_data as string | null) ?? null,
        avatarColor: (data.avatar_color as string | null) ?? null,
        avatarFrame: (data.avatar_frame as string | null) ?? null,
        isActive: Boolean(data.is_active),
        memberSince: (data.created_at as string | null) ?? null,
        isPublic: data.profile_public !== false,
        details: Boolean(data.details),
      };
    },
    async progress(id) {
      const { data, error } = await client.rpc('profile_task_stats', { p_id: id });
      if (error) throw new Error('Badges could not be loaded.');
      // Someone else's private profile: no badges to show.
      if (data === null) return null;
      const r = (data ?? {}) as Record<string, number> & { by_list?: TaskStats['byList'] };
      return {
        xp: r.xp ?? 0,
        stats: {
          total: r.total ?? 0,
          field: r.field ?? 0,
          office: r.office ?? 0,
          byList: { relief: 0, assessment: 0, logistics: 0, beneficiaries: 0, reports: 0, volunteers: 0, coordination: 0, office: 0, ...r.by_list },
          onTime: r.on_time ?? 0,
          rapidHigh: r.rapid_high ?? 0,
          fromOthers: r.from_others ?? 0,
          planned: r.planned ?? 0,
          streak: r.streak ?? 0,
          bestStreak: r.best_streak ?? 0,
          kudos: r.kudos ?? 0,
        },
      };
    },
    async pictures(ids) {
      const out: Record<string, ProfilePicture> = {};
      for (let i = 0; i < ids.length; i += 100) {
        const slice = ids.slice(i, i + 100);
        const read = (cols: string) => client.from('profiles').select(cols).in('id', slice).returns<Record<string, unknown>[]>();
        let { data, error } = await read('id, avatar_data, avatar_color, avatar_frame');
        // A database without frames yet: the pictures still load.
        if (error && missingColumn(error)) ({ data, error } = await read('id, avatar_data, avatar_color'));
        if (error) throw new Error('Profile pictures could not be loaded.');
        for (const r of data ?? [])
          out[r.id as string] = { avatar: (r.avatar_data as string | null) ?? null, color: (r.avatar_color as string | null) ?? null, frame: (r.avatar_frame as string | null) ?? null };
      }
      return out;
    },
    async save(id, p) {
      validate(p);
      const fields = {
        full_name: p.fullName.trim(),
        display_name: p.displayName.trim(),
        job_title: p.jobTitle.trim() || null,
        phone: p.phone.trim() || null,
        bio: p.bio.trim() || null,
        avatar_data: p.avatar,
        avatar_color: p.avatarColor,
        profile_public: p.isPublic,
      };
      let { data, error } = await client.from('profiles').update({ ...fields, avatar_frame: p.avatarFrame }).eq('id', id).select('id');
      // A database without frames yet: save the rest, and say so if a frame was chosen.
      if (error && missingColumn(error)) {
        ({ data, error } = await client.from('profiles').update(fields).eq('id', id).select('id'));
        if (!error && p.avatarFrame) throw new ProfileRuleError('Saved, but frames aren’t switched on yet. Try the frame again later.');
      }
      if (error) throw new ProfileRuleError(error.code?.startsWith('23') ? 'Check the details: one of them isn’t accepted.' : 'Your profile could not be saved. Check the connection and try again.');
      if (!data?.length) throw new ProfileRuleError('You can only change your own profile.');
    },
  };
}

// ───────────────────────── Sample data ─────────────────────────

const STORE = 'philrads.sample.profile.v1';
const SAMPLE: Record<string, Omit<PersonProfile, 'initials' | 'memberSince' | 'isPublic' | 'details'>> = {
  'p-maria': { id: 'p-maria', fullName: 'Maria Santos', displayName: 'Maria Santos', roleName: 'Coordinator', office: 'Naga field office', jobTitle: 'Relief operations coordinator', phone: '+63 917 555 0101', bio: 'Leads relief distributions in Bicol. Ask me about logistics and partner churches.', avatar: null, avatarColor: '#3f8f5b', avatarFrame: 'aurora', isActive: true },
  'p-jun': { id: 'p-jun', fullName: 'Jun Dela Cruz', displayName: 'Jun Dela Cruz', roleName: 'Staff', office: 'Main office', jobTitle: 'Warehouse officer', phone: null, bio: null, avatar: null, avatarColor: '#3c5fa8', avatarFrame: null, isActive: true },
  'p-ana': { id: 'p-ana', fullName: 'Ana Reyes', displayName: 'Ana Reyes', roleName: 'Coordinator', office: 'Main office', jobTitle: 'Livelihood program officer', phone: null, bio: 'Small-business coaching and monitoring.', avatar: null, avatarColor: '#a03f7a', avatarFrame: 'sakura', isActive: true },
  'p-leo': { id: 'p-leo', fullName: 'Leo Mendoza', displayName: 'Leo Mendoza', roleName: 'Volunteer', office: null, jobTitle: 'Field volunteer', phone: null, bio: null, avatar: null, avatarColor: null, avatarFrame: 'orbit', isActive: true },
  'p-grace': { id: 'p-grace', fullName: 'Grace Lim', displayName: 'Grace Lim', roleName: 'Staff', office: 'Main office', jobTitle: 'Documentation officer', phone: null, bio: 'Photos, reports and the stories behind them.', avatar: null, avatarColor: '#2f7f8f', avatarFrame: null, isActive: true },
};
const sampleStats = (n: number): ProfileProgress => ({
  xp: n * 23,
  stats: {
    total: n,
    field: Math.round(n * 0.6),
    office: Math.round(n * 0.4),
    byList: { relief: Math.round(n * 0.35), assessment: Math.round(n * 0.15), logistics: Math.round(n * 0.2), beneficiaries: 4, reports: 6, volunteers: 2, coordination: 3, office: 5 },
    onTime: Math.round(n * 0.5),
    rapidHigh: n > 20 ? 4 : 1,
    fromOthers: Math.round(n * 0.7),
    planned: Math.round(n * 0.3),
    streak: 3,
    bestStreak: n > 20 ? 9 : 4,
    kudos: n > 20 ? 2 : 0,
  },
});
const SAMPLE_PROGRESS: Record<string, number> = { 'p-maria': 64, 'p-jun': 28, 'p-ana': 17, 'p-leo': 3 };

const readMine = (): Partial<PersonProfile> => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<PersonProfile>;
  } catch {
    return {};
  }
};

export const mockProfileService: ProfileService = {
  source: 'mock',
  async get(id) {
    await new Promise((r) => setTimeout(r, 200));
    if (id === demoProfile.id) {
      const base = { id, fullName: 'Demo User', displayName: demoProfile.displayName, roleName: demoProfile.roleName ?? null, office: demoProfile.office ?? null, jobTitle: null, phone: null, bio: null, avatar: null, avatarColor: null, avatarFrame: null, isActive: true, memberSince: '2026-10-18T08:00:00+08:00', isPublic: true, details: true };
      const p = { ...base, ...readMine() };
      return { ...p, initials: initialsOf(p.displayName) };
    }
    const p = SAMPLE[id];
    if (!p) return null;
    // Sample: Jun keeps his profile private.
    const isPublic = id !== 'p-jun';
    return isPublic
      ? { ...p, initials: initialsOf(p.displayName), memberSince: '2026-10-20T08:00:00+08:00', isPublic, details: true }
      : { ...p, office: null, jobTitle: null, phone: null, bio: null, initials: initialsOf(p.displayName), memberSince: null, isPublic, details: false };
  },
  async progress(id) {
    if (id === 'p-jun') return null;
    if (id !== demoProfile.id) return sampleStats(SAMPLE_PROGRESS[id] ?? 0);
    // The demo user's real sample tasks, scored the same way as on the Tasks page.
    const [tasks, p] = await Promise.all([mockTasksService.list(), mockTasksService.progress()]);
    const r = computeProgress({ awards: p.awards, kudos: p.kudos, tasks, userId: id });
    return { xp: r.xp, stats: r.stats };
  },
  async pictures(ids) {
    const mine = readMine();
    return Object.fromEntries(
      ids.map((id) => [
        id,
        id === demoProfile.id
          ? { avatar: mine.avatar ?? null, color: mine.avatarColor ?? null, frame: mine.avatarFrame ?? null }
          : { avatar: SAMPLE[id]?.avatar ?? null, color: SAMPLE[id]?.avatarColor ?? null, frame: SAMPLE[id]?.avatarFrame ?? null },
      ]),
    );
  },
  async save(id, p) {
    validate(p);
    if (id !== demoProfile.id) throw new ProfileRuleError('You can only change your own profile.');
    try {
      localStorage.setItem(
        STORE,
        JSON.stringify({ fullName: p.fullName.trim(), displayName: p.displayName.trim(), jobTitle: p.jobTitle.trim() || null, phone: p.phone.trim() || null, bio: p.bio.trim() || null, avatar: p.avatar, avatarColor: p.avatarColor, avatarFrame: p.avatarFrame, isPublic: p.isPublic }),
      );
    } catch {
      throw new ProfileRuleError('This device couldn’t keep the sample profile (storage is full or off).');
    }
  },
};
