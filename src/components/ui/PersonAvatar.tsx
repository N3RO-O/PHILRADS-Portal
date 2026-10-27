import { useEffect, useReducer } from 'react';
import { initialsOf } from '../../lib/format';
import { profileService } from '../../services';
import type { ProfilePicture } from '../../services/profiles/profileService';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from './Avatar';

// People's pictures, fetched together (one request for a whole team list) and kept for the visit.
const cache = new Map<string, ProfilePicture>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

const flush = async () => {
  timer = null;
  const ids = [...pending];
  try {
    const found = await profileService.pictures(ids);
    for (const id of ids) cache.set(id, found[id] ?? { avatar: null, color: null });
  } catch {
    // Initials it is; try again on the next visit.
    for (const id of ids) cache.set(id, { avatar: null, color: null });
  } finally {
    for (const id of ids) pending.delete(id);
    for (const l of listeners) l();
  }
};

const request = (id: string) => {
  if (cache.has(id) || pending.has(id)) return;
  pending.add(id);
  timer ??= setTimeout(() => void flush(), 0);
};

/** Someone's profile picture (or initials in their colour). Your own follows your profile straight away. */
export function PersonAvatar({ id, name, size }: { id: string | null | undefined; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const { profile } = useAuth();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const own = Boolean(profile && id === profile.id);
  useEffect(() => {
    if (!id || own) return;
    listeners.add(rerender);
    request(id);
    return () => void listeners.delete(rerender);
  }, [id, own]);
  const pic = own ? { avatar: profile!.avatar ?? null, color: profile!.avatarColor ?? null } : id ? cache.get(id) : undefined;
  return <Avatar initials={initialsOf(name || '?')} src={pic?.avatar} color={pic?.color} size={size} />;
}
