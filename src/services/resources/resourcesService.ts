import type { SupabaseClient } from '@supabase/supabase-js';
import { PLACEHOLDER_ROLE_PERMISSIONS } from '../../config/permissions';
import { createResourceSeed } from '../../data/mockResources';
import { demoProfile } from '../../data/mockDashboard';
import { validateResource } from '../../lib/resources';
import { parseResourceLink, type LinkKind } from '../../lib/resourceLinks';
import { ResourceRuleError, type FolderItem, type FolderListing, type Resource, type ResourceCategory, type ResourceFileType, type ResourcesService } from './types';

// ───────────────────────── Sample data (this browser only) ─────────────────────────

const STORE_KEY = 'philrads.sample.resources.v1';
let sample: Resource[] | null = null;
const sampleState = (): Resource[] => {
  if (sample) return sample;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return (sample = JSON.parse(raw) as Resource[]);
  } catch {
    /* fall back to the seed */
  }
  return (sample = createResourceSeed());
};
const persist = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(sampleState()));
  } catch {
    /* storage unavailable: changes last until reload */
  }
};
const later = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 200));
const demoCanManage = () => {
  let role = demoProfile.roleKey;
  try {
    role = localStorage.getItem('philrads.demo.role') ?? role;
  } catch {
    /* default role */
  }
  return (PLACEHOLDER_ROLE_PERMISSIONS[role] ?? []).includes('resources.manage');
};

export const mockResourcesService: ResourcesService = {
  source: 'mock',
  async list() {
    if (!navigator.onLine) throw new TypeError('Failed to fetch (offline)');
    return later(structuredClone(sampleState()));
  },
  async save(d) {
    if (!demoCanManage()) throw new ResourceRuleError('Your role can open resources but not add or edit them.');
    const errors = validateResource(d, sampleState());
    const first = Object.values(errors)[0];
    if (first) throw new ResourceRuleError(first);
    const now = new Date().toISOString();
    const prev = sampleState().find((r) => r.id === d.id);
    const saved: Resource = {
      id: d.id ?? `res-${crypto.randomUUID?.() ?? Date.now()}`,
      title: d.title.trim(),
      description: d.description.trim() || null,
      category: d.category,
      url: d.url.trim(),
      kind: parseResourceLink(d.url)!.kind,
      fileType: d.fileType,
      pinned: d.pinned,
      addedByName: prev?.addedByName ?? demoProfile.displayName,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    sample = prev ? sampleState().map((r) => (r.id === saved.id ? saved : r)) : [saved, ...sampleState()];
    persist();
    return later(structuredClone(saved));
  },
  async remove(id) {
    if (!demoCanManage()) throw new ResourceRuleError('Your role can open resources but not remove them.');
    sample = sampleState().filter((r) => r.id !== id);
    persist();
    await later(null);
  },
  async folder(_resourceId, folderId) {
    return later(sampleFolder(folderId));
  },
};

/** A made-up folder for sample mode (files can't be opened or downloaded). */
function sampleFolder(folderId?: string): FolderListing {
  const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  const file = (id: string, name: string, mimeType: string, sizeBytes: number | null, d: number, downloadAs: string | null = null): FolderItem => ({
    id,
    name,
    mimeType,
    folder: false,
    sizeBytes,
    modifiedAt: day(d),
    durationMs: mimeType.startsWith('video/') ? 94_000 : null,
    width: null,
    height: null,
    downloadAs,
    links: { thumb: null, view: '#', download: '#' },
  });
  const folder = (id: string, name: string, d: number): FolderItem => ({ id, name, mimeType: 'application/vnd.google-apps.folder', folder: true, sizeBytes: null, modifiedAt: day(d), durationMs: null, width: null, height: null, downloadAs: null, links: null });
  if (folderId === 'sample-sub-photos')
    return {
      path: [{ id: 'sample-root', name: 'Shared files (sample)' }, { id: 'sample-sub-photos', name: 'Photos' }],
      items: [1, 2, 3, 4, 5, 6].map((i) => file(`sample-photo-${i}`, `Distribution day ${i}.jpg`, 'image/jpeg', 2_400_000 + i * 90_000, i)),
    };
  return {
    path: [{ id: 'sample-root', name: 'Shared files (sample)' }],
    items: [
      folder('sample-sub-photos', 'Photos', 2),
      folder('sample-sub-reports', 'Reports', 9),
      file('sample-f1', 'Relief distribution acknowledgement form', 'application/vnd.google-apps.document', null, 3, '.docx'),
      file('sample-f2', 'Beneficiary master list template', 'application/vnd.google-apps.spreadsheet', null, 5, '.xlsx'),
      file('sample-f3', 'Child safeguarding policy.pdf', 'application/pdf', 812_000, 20),
      file('sample-f4', 'Orientation for volunteers.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 5_400_000, 31),
      file('sample-f5', 'Typhoon response briefing.mp4', 'video/mp4', 48_000_000, 12),
    ],
  };
}

// ───────────────────────── Supabase ─────────────────────────

/** Live resources. Row Level Security decides who can read (resources.read) and change (resources.manage). */
export function createSupabaseResourcesService(client: SupabaseClient): ResourcesService {
  const fail = (what: string, error: { message: string; code?: string }): never => {
    console.error(`[resources] ${what}`, error);
    if (error.code === '23505') throw new ResourceRuleError('This link is already in Resources.');
    if (error.code === '42501') throw new ResourceRuleError('Your role does not allow this.');
    if (error.code && error.code.startsWith('23')) throw new ResourceRuleError('The server rejected this resource. Check the title and link.');
    throw new Error(`Could not ${what}. Check the connection and try again.`);
  };
  const columns = 'id, title, description, category, url, kind, file_type, pinned, created_at, updated_at, adder:profiles!resources_created_by_fkey(display_name)';
  const map = (r: Record<string, unknown>): Resource => ({
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    category: r.category as ResourceCategory,
    url: r.url as string,
    kind: r.kind as LinkKind,
    fileType: (r.file_type as ResourceFileType | null) ?? null,
    pinned: Boolean(r.pinned),
    addedByName: (r.adder as { display_name?: string } | null)?.display_name || 'Staff member',
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  });

  return {
    source: 'supabase',
    async list() {
      const { data, error } = await client.from('resources').select(columns).eq('is_active', true).order('updated_at', { ascending: false }).limit(1000);
      if (error) fail('load resources', error);
      return (data ?? []).map(map);
    },
    async save(d) {
      const link = parseResourceLink(d.url);
      if (!link) throw new ResourceRuleError('Use a full https:// link.');
      const row = {
        title: d.title.trim(),
        description: d.description.trim() || null,
        category: d.category,
        url: d.url.trim(),
        kind: link.kind,
        file_type: d.fileType,
        pinned: d.pinned,
      };
      const q = d.id ? client.from('resources').update(row).eq('id', d.id) : client.from('resources').insert(row);
      const { data, error } = await q.select(columns).single();
      if (error) fail('save this resource', error);
      return map(data as Record<string, unknown>);
    },
    async remove(id) {
      // Soft delete: the history stays; the Drive file is never touched.
      const { error } = await client.from('resources').update({ is_active: false }).eq('id', id);
      if (error) fail('remove this resource', error);
    },
    async folder(resourceId, folderId) {
      const { data } = await client.auth.getSession();
      let res: Response;
      try {
        res = await fetch('/api/drive/folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
          body: JSON.stringify({ resource: resourceId, folder: folderId }),
        });
      } catch {
        throw new Error('No connection. Check the signal and try again.');
      }
      const body = (await res.json().catch(() => ({}))) as FolderListing & { error?: string };
      if (!res.ok) throw new ResourceRuleError(body.error ?? `The server said no (${res.status}).`);
      return body;
    },
  };
}
