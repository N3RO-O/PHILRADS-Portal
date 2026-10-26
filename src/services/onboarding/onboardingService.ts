import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyOnboarding, mergeOnboarding, unionOnboarding, type OnboardingPatch, type OnboardingState } from '../../lib/onboarding';
import type { DataSource } from '../../types';

export interface OnboardingService {
  readonly source: DataSource;
  /** Progress for this person: the account's copy, merged with anything this device saved offline. */
  load(userId: string): Promise<OnboardingState>;
  /** Saves on this device at once, then to the account (retried on the next load if offline). */
  update(userId: string, patch: OnboardingPatch): Promise<OnboardingState>;
}

const key = (userId: string) => `philrads.onboarding.v1.${userId}`;
const readLocal = (userId: string): OnboardingState => {
  try {
    const raw = localStorage.getItem(key(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as OnboardingState;
      return { ...parsed, steps: parsed.steps ?? {} };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return emptyOnboarding();
};
const writeLocal = (userId: string, state: OnboardingState) => {
  try {
    localStorage.setItem(key(userId), JSON.stringify(state));
  } catch {
    /* storage unavailable: progress lasts until reload (and is still saved to the account) */
  }
};

/** Sample mode: this browser only. */
export const mockOnboardingService: OnboardingService = {
  source: 'mock',
  async load(userId) {
    return readLocal(userId);
  },
  async update(userId, patch) {
    const next = mergeOnboarding(readLocal(userId), patch);
    writeLocal(userId, next);
    return next;
  },
};

export function createSupabaseOnboardingService(client: SupabaseClient): OnboardingService {
  const push = async (patch: OnboardingPatch) => {
    const { data, error } = await client.rpc('update_onboarding', { p_patch: patch });
    if (error) throw error;
    return { ...(data as OnboardingState), steps: (data as OnboardingState)?.steps ?? {} };
  };

  return {
    source: 'supabase',
    async load(userId) {
      const local = readLocal(userId);
      const { data, error } = await client.from('profiles').select('onboarding').eq('id', userId).maybeSingle();
      if (error || !data) return local; // offline or not loaded: carry on with this device's copy
      const server = { ...(data.onboarding as OnboardingState), steps: (data.onboarding as OnboardingState)?.steps ?? {} };
      const merged = unionOnboarding(server, local);
      writeLocal(userId, merged);
      // Anything done on this device while offline goes up now.
      const missing = Object.fromEntries(Object.entries(merged.steps).filter(([k]) => !(k in server.steps)));
      const flagsDiffer = merged.focus !== server.focus || merged.question !== server.question || merged.hidden !== server.hidden || Boolean(merged.coachSeen) !== Boolean(server.coachSeen);
      if (Object.keys(missing).length || flagsDiffer) {
        const { steps: _steps, ...flags } = merged;
        void push({ ...flags, steps: missing }).catch(() => undefined);
      }
      return merged;
    },
    async update(userId, patch) {
      const next = mergeOnboarding(readLocal(userId), patch);
      writeLocal(userId, next);
      try {
        return unionOnboarding(await push(patch), next);
      } catch {
        return next; // saved on this device; sent with the next load
      }
    },
  };
}
