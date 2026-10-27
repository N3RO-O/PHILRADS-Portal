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
  isActive: boolean;
  /** When the account was made. */
  memberSince: string | null;
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
  progress(id: string): Promise<ProfileProgress>;
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

export function createSupabaseProfileService(client: SupabaseClient): ProfileService {
  return {
    source: 'supabase',
    async get(id) {
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name, display_name, office, is_active, created_at, job_title, phone, bio, avatar_data, avatar_color, roles(name)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error('This profile could not be loaded. Check the connection and try again.');
      if (!data) return null;
      const displayName = ((data.display_name as string) || (data.full_name as string) || 'Staff member').trim();
      return {
        id: data.id as string,
        fullName: ((data.full_name as string) || displayName).trim(),
        displayName,
        initials: initialsOf(displayName),
        roleName: (data.roles as unknown as { name?: string } | null)?.name ?? null,
        office: (data.office as string | null) ?? null,
        jobTitle: (data.job_title as string | null) ?? null,
        phone: (data.phone as string | null) ?? null,
        bio: (data.bio as string | null) ?? null,
        avatar: (data.avatar_data as string | null) ?? null,
        avatarColor: (data.avatar_color as string | null) ?? null,
        isActive: Boolean(data.is_active),
        memberSince: (data.created_at as string | null) ?? null,
      };
    },
    async progress(id) {
      const { data, error } = await client.rpc('profile_task_stats', { p_id: id });
      if (error) throw new Error('Badges could not be loaded.');
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
    async save(id, p) {
      validate(p);
      const { data, error } = await client
        .from('profiles')
        .update({
          full_name: p.fullName.trim(),
          display_name: p.displayName.trim(),
          job_title: p.jobTitle.trim() || null,
          phone: p.phone.trim() || null,
          bio: p.bio.trim() || null,
          avatar_data: p.avatar,
          avatar_color: p.avatarColor,
        })
        .eq('id', id)
        .select('id');
      if (error) throw new ProfileRuleError(error.code?.startsWith('23') ? 'Check the details: one of them isn’t accepted.' : 'Your profile could not be saved. Check the connection and try again.');
      if (!data?.length) throw new ProfileRuleError('You can only change your own profile.');
    },
  };
}

// ───────────────────────── Sample data ─────────────────────────

const STORE = 'philrads.sample.profile.v1';
const SAMPLE: Record<string, Omit<PersonProfile, 'initials' | 'memberSince'>> = {
  'p-maria': { id: 'p-maria', fullName: 'Maria Santos', displayName: 'Maria Santos', roleName: 'Coordinator', office: 'Naga field office', jobTitle: 'Relief operations coordinator', phone: '+63 917 555 0101', bio: 'Leads relief distributions in Bicol. Ask me about logistics and partner churches.', avatar: null, avatarColor: '#3f8f5b', isActive: true },
  'p-jun': { id: 'p-jun', fullName: 'Jun Dela Cruz', displayName: 'Jun Dela Cruz', roleName: 'Staff', office: 'Main office', jobTitle: 'Warehouse officer', phone: null, bio: null, avatar: null, avatarColor: '#3c5fa8', isActive: true },
  'p-ana': { id: 'p-ana', fullName: 'Ana Reyes', displayName: 'Ana Reyes', roleName: 'Coordinator', office: 'Main office', jobTitle: 'Livelihood program officer', phone: null, bio: 'Small-business coaching and monitoring.', avatar: null, avatarColor: '#a03f7a', isActive: true },
  'p-leo': { id: 'p-leo', fullName: 'Leo Mendoza', displayName: 'Leo Mendoza', roleName: 'Volunteer', office: null, jobTitle: 'Field volunteer', phone: null, bio: null, avatar: null, avatarColor: null, isActive: true },
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
      const base = { id, fullName: 'Demo User', displayName: demoProfile.displayName, roleName: demoProfile.roleName ?? null, office: demoProfile.office ?? null, jobTitle: null, phone: null, bio: null, avatar: null, avatarColor: null, isActive: true, memberSince: '2026-10-18T08:00:00+08:00' };
      const p = { ...base, ...readMine() };
      return { ...p, initials: initialsOf(p.displayName) };
    }
    const p = SAMPLE[id];
    return p ? { ...p, initials: initialsOf(p.displayName), memberSince: '2026-10-20T08:00:00+08:00' } : null;
  },
  async progress(id) {
    if (id !== demoProfile.id) return sampleStats(SAMPLE_PROGRESS[id] ?? 0);
    // The demo user's real sample tasks, scored the same way as on the Tasks page.
    const [tasks, p] = await Promise.all([mockTasksService.list(), mockTasksService.progress()]);
    const r = computeProgress({ awards: p.awards, kudos: p.kudos, tasks, userId: id });
    return { xp: r.xp, stats: r.stats };
  },
  async save(id, p) {
    validate(p);
    if (id !== demoProfile.id) throw new ProfileRuleError('You can only change your own profile.');
    try {
      localStorage.setItem(
        STORE,
        JSON.stringify({ fullName: p.fullName.trim(), displayName: p.displayName.trim(), jobTitle: p.jobTitle.trim() || null, phone: p.phone.trim() || null, bio: p.bio.trim() || null, avatar: p.avatar, avatarColor: p.avatarColor }),
      );
    } catch {
      throw new ProfileRuleError('This device couldn’t keep the sample profile (storage is full or off).');
    }
  },
};
