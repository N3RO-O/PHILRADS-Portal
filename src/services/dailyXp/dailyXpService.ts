import type { SupabaseClient } from '@supabase/supabase-js';
import { manilaDayKey } from '../../lib/format';

/** XP for checking in: claimable once per Manila day. The account decides; the app only asks. */
export const DAILY_XP = 10;

export interface DailyXpStatus {
  /** All the daily XP this person has claimed. */
  total: number;
  /** Already claimed today (Manila time). */
  claimedToday: boolean;
}

export interface DailyXpService {
  status(userId: string): Promise<DailyXpStatus>;
  /** Claims today's XP. Claiming twice in a day pays nothing more. */
  claim(userId: string): Promise<DailyXpStatus>;
}

const key = (userId: string) => `philrads.dailyxp.v1.${userId}`;
const days = (userId: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key(userId)) ?? '[]');
    return Array.isArray(v) ? v.filter((d) => typeof d === 'string') : [];
  } catch {
    return [];
  }
};
const today = () => manilaDayKey(new Date().toISOString());

export const mockDailyXpService: DailyXpService = {
  async status(userId) {
    const d = days(userId);
    return { total: d.length * DAILY_XP, claimedToday: d.includes(today()) };
  },
  async claim(userId) {
    const d = days(userId);
    if (!d.includes(today())) d.push(today());
    try {
      localStorage.setItem(key(userId), JSON.stringify(d));
    } catch {
      /* storage unavailable: counted for this visit only */
    }
    return { total: d.length * DAILY_XP, claimedToday: true };
  },
};

export function createSupabaseDailyXpService(client: SupabaseClient): DailyXpService {
  const status = async (userId: string): Promise<DailyXpStatus> => {
    const { data, error } = await client.from('daily_xp_claims').select('day, points').eq('user_id', userId);
    if (error || !data) return { total: 0, claimedToday: true }; // not set up yet, or offline: nothing to claim
    return {
      total: data.reduce((s, r) => s + (Number(r.points) || 0), 0),
      claimedToday: data.some((r) => r.day === today()),
    };
  };
  return {
    status,
    async claim(userId) {
      const { error } = await client.rpc('claim_daily_xp');
      if (error) throw new Error('Couldn’t claim today’s XP. Check your connection and try again.');
      return status(userId);
    },
  };
}
