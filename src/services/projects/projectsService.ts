import type { SupabaseClient } from '@supabase/supabase-js';
import { PLACEHOLDER_ROLE_PERMISSIONS } from '../../config/permissions';
import { demoProfile } from '../../data/mockDashboard';
import type { DataSource } from '../../types';

/**
 * Projects: PHILRADS programs and projects with their milestones, reporting deadlines and team.
 * Every active staff member sees every project; coordinators/admins and the project's lead manage
 * it; the team ticks milestones off and progress follows them
 * (supabase/migrations/20261028000300_projects_module.sql).
 */

export const PROJECT_STATUSES = [
  { key: 'active', label: 'Active' },
  { key: 'planned', label: 'Planned' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]['key'];
export const statusLabel = (s: ProjectStatus) => PROJECT_STATUSES.find((x) => x.key === s)?.label ?? s;

/** Suggestions for the project type (any text is fine). */
export const PROJECT_TYPES = [
  'Disaster response',
  'Recovery and rehabilitation',
  'Disaster preparedness',
  'Livelihood',
  'Health and nutrition',
  'Water, sanitation and hygiene',
  'Education',
  'Community development',
];

export interface ProjectMember {
  profileId: string;
  name: string;
  role: 'lead' | 'member';
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  /** A reporting deadline (e.g. to the donor) rather than a step of the work. */
  kind: 'milestone' | 'report';
  /** YYYY-MM-DD */
  dueDate: string | null;
  done: boolean;
  doneAt: string | null;
  doneByName: string | null;
  position: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  /** Project type, e.g. Disaster response, Livelihood. */
  programArea: string | null;
  status: ProjectStatus;
  /** 0–100; follows the milestones once there are any. */
  progress: number;
  startDate: string | null;
  endDate: string | null;
  leadId: string | null;
  leadName: string | null;
  partner: string | null;
  donor: string | null;
  location: string | null;
  /** People the project plans to reach (changes as it goes on). */
  beneficiariesTarget: number | null;
  /** People reached beyond the plan. */
  beneficiariesAdditional: number;
  members: ProjectMember[];
  milestones: Milestone[];
  updatedAt: string;
}

export interface ProjectDraft {
  id?: string;
  name: string;
  description: string;
  programArea: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  leadId: string | null;
  partner: string;
  donor: string;
  location: string;
  beneficiariesTarget: number | null;
  beneficiariesAdditional: number;
}

export interface MilestoneDraft {
  title: string;
  kind: Milestone['kind'];
  dueDate: string | null;
}

export interface ProjectActivity {
  id: number;
  at: string;
  who: string;
  summary: string;
}

export class ProjectRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectRuleError';
  }
}

export interface ProjectsService {
  readonly source: DataSource;
  list(): Promise<Project[]>;
  save(draft: ProjectDraft): Promise<string>;
  setStatus(id: string, status: ProjectStatus): Promise<void>;
  /** People to reach and additional beneficiaries (the lead or a coordinator; logged). */
  setPeople(id: string, target: number | null, additional: number): Promise<void>;
  addMember(projectId: string, profileId: string): Promise<void>;
  removeMember(projectId: string, profileId: string): Promise<void>;
  addMilestone(projectId: string, m: MilestoneDraft): Promise<void>;
  setMilestoneDone(id: string, done: boolean): Promise<void>;
  removeMilestone(id: string): Promise<void>;
  activity(projectId: string): Promise<ProjectActivity[]>;
  people(): Promise<{ id: string; name: string }[]>;
}

/** Sorted the way the page shows them: open ones by due date, then done ones. */
export const orderMilestones = (ms: Milestone[]) =>
  [...ms].sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.position - b.position);

/** The next open milestone or report (the soonest due). */
export const nextDeadline = (p: Project) => orderMilestones(p.milestones).find((m) => !m.done) ?? null;

const checkPeople = (target: number | null, additional: number) => {
  if (target != null && (target < 0 || !Number.isInteger(target))) throw new ProjectRuleError('People to reach is a whole number.');
  if (additional < 0 || !Number.isInteger(additional)) throw new ProjectRuleError('Additional beneficiaries is a whole number.');
};

const validate = (d: ProjectDraft) => {
  if (!d.name.trim()) throw new ProjectRuleError('Give the project a name.');
  if (d.name.trim().length > 200) throw new ProjectRuleError('Keep the name under 200 characters.');
  if (d.startDate && d.endDate && d.endDate < d.startDate) throw new ProjectRuleError('The end date is before the start date.');
  checkPeople(d.beneficiariesTarget, d.beneficiariesAdditional);
};

// ───────────────────────── Supabase ─────────────────────────

const COLUMNS =
  'id, name, description, program_area, status, progress_percent, start_date, end_date, lead_id, partner, donor, location, beneficiaries_target, beneficiaries_additional, updated_at, ' +
  'lead:profiles!projects_lead_id_fkey(display_name), ' +
  'members:project_members(profile_id, member_role, person:profiles(display_name)), ' +
  'milestones:project_milestones(id, project_id, title, kind, due_date, done, done_at, position, by:profiles!project_milestones_done_by_fkey(display_name))';

export function createSupabaseProjectsService(client: SupabaseClient): ProjectsService {
  const name = (p: unknown) => ((p as { display_name?: string } | null)?.display_name ?? '').trim() || null;
  const fail = (what: string, error: { message: string; code?: string }): never => {
    console.error(`[projects] ${what}`, error);
    if (error.code === '42501') throw new ProjectRuleError(/row-level security|permission denied/i.test(error.message) ? 'Your role doesn’t allow this.' : error.message);
    if (error.code === '23505') throw new ProjectRuleError('That project code is already used.');
    if (error.code?.startsWith('23')) throw new ProjectRuleError('Check the details and try again.');
    throw new Error(`Could not ${what}. Check the connection and try again.`);
  };
  const map = (r: Record<string, unknown>): Project => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    programArea: (r.program_area as string | null) ?? null,
    status: r.status as ProjectStatus,
    progress: Number(r.progress_percent ?? 0),
    startDate: (r.start_date as string | null) ?? null,
    endDate: (r.end_date as string | null) ?? null,
    leadId: (r.lead_id as string | null) ?? null,
    leadName: name(r.lead),
    partner: (r.partner as string | null) ?? null,
    donor: (r.donor as string | null) ?? null,
    location: (r.location as string | null) ?? null,
    beneficiariesTarget: r.beneficiaries_target == null ? null : Number(r.beneficiaries_target),
    beneficiariesAdditional: Number(r.beneficiaries_additional ?? 0),
    members: ((r.members as Record<string, unknown>[]) ?? []).map((m) => ({ profileId: m.profile_id as string, name: name(m.person) ?? 'Staff member', role: m.member_role as 'lead' | 'member' })),
    milestones: ((r.milestones as Record<string, unknown>[]) ?? []).map((m) => ({
      id: m.id as string,
      projectId: m.project_id as string,
      title: m.title as string,
      kind: m.kind as Milestone['kind'],
      dueDate: (m.due_date as string | null) ?? null,
      done: Boolean(m.done),
      doneAt: (m.done_at as string | null) ?? null,
      doneByName: name(m.by),
      position: Number(m.position ?? 0),
    })),
    updatedAt: r.updated_at as string,
  });

  return {
    source: 'supabase',
    async list() {
      const { data, error } = await client.from('projects').select(COLUMNS).order('updated_at', { ascending: false }).limit(500);
      if (error) fail('load projects', error);
      return (data ?? []).map((r) => map(r as unknown as Record<string, unknown>));
    },
    async save(d) {
      validate(d);
      const row = {
        name: d.name.trim(),
        description: d.description.trim() || null,
        program_area: d.programArea.trim() || null,
        status: d.status,
        start_date: d.startDate,
        end_date: d.endDate,
        lead_id: d.leadId,
        partner: d.partner.trim() || null,
        donor: d.donor.trim() || null,
        location: d.location.trim() || null,
        beneficiaries_target: d.beneficiariesTarget,
        beneficiaries_additional: d.beneficiariesAdditional,
      };
      const q = d.id ? client.from('projects').update(row).eq('id', d.id) : client.from('projects').insert(row);
      const { data, error } = await q.select('id').single();
      if (error) fail('save the project', error);
      return (data as { id: string }).id;
    },
    async setStatus(id, status) {
      const { error } = await client.from('projects').update({ status }).eq('id', id);
      if (error) fail('change the status', error);
    },
    async setPeople(id, target, additional) {
      checkPeople(target, additional);
      const { data, error } = await client.from('projects').update({ beneficiaries_target: target, beneficiaries_additional: additional }).eq('id', id).select('id');
      if (error) fail('save the numbers', error);
      if (!data?.length) throw new ProjectRuleError('Only the project lead or a coordinator can change this.');
    },
    async addMember(projectId, profileId) {
      const { error } = await client.from('project_members').upsert({ project_id: projectId, profile_id: profileId, member_role: 'member' }, { onConflict: 'project_id,profile_id' });
      if (error) fail('add them to the team', error);
    },
    async removeMember(projectId, profileId) {
      const { error } = await client.from('project_members').delete().eq('project_id', projectId).eq('profile_id', profileId);
      if (error) fail('remove them from the team', error);
    },
    async addMilestone(projectId, m) {
      if (!m.title.trim()) throw new ProjectRuleError('Give it a title.');
      const { error } = await client.from('project_milestones').insert({ project_id: projectId, title: m.title.trim(), kind: m.kind, due_date: m.dueDate });
      if (error) fail('add the milestone', error);
    },
    async setMilestoneDone(id, done) {
      const { data, error } = await client.from('project_milestones').update({ done }).eq('id', id).select('id');
      if (error) fail('update the milestone', error);
      if (!data?.length) throw new ProjectRuleError('Only the project’s team can tick this off.');
    },
    async removeMilestone(id) {
      const { error } = await client.from('project_milestones').delete().eq('id', id);
      if (error) fail('remove the milestone', error);
    },
    async activity(projectId) {
      const { data, error } = await client
        .from('activity_logs')
        .select('id, created_at, summary, actor:profiles!activity_logs_actor_id_fkey(display_name)')
        .eq('entity_type', 'project')
        .eq('entity_id', projectId)
        .order('id', { ascending: false })
        .limit(50);
      if (error) return [];
      return (data ?? []).map((r) => ({ id: Number(r.id), at: r.created_at as string, who: name((r as Record<string, unknown>).actor) ?? 'Someone', summary: r.summary as string }));
    },
    async people() {
      const { data, error } = await client.from('profiles').select('id, display_name, full_name').eq('is_active', true).order('display_name').limit(500);
      if (error) fail('load staff names', error);
      return (data ?? []).map((p) => ({ id: p.id as string, name: ((p.full_name as string) || (p.display_name as string) || 'Staff member').trim() }));
    },
  };
}

// ───────────────────────── Sample data ─────────────────────────

const dayOffset = (n: number) => new Date(Date.now() + n * 86_400_000 + 8 * 3600_000).toISOString().slice(0, 10);
const demoCanManage = () => {
  try {
    const role = localStorage.getItem('philrads.demo.role') ?? 'admin';
    return (PLACEHOLDER_ROLE_PERMISSIONS[role] ?? []).includes('projects.manage');
  } catch {
    return true;
  }
};
const SAMPLE_PEOPLE = [
  { id: demoProfile.id, name: demoProfile.displayName },
  { id: 'p-maria', name: 'Maria Santos' },
  { id: 'p-jun', name: 'Jun Dela Cruz' },
  { id: 'p-ana', name: 'Ana Reyes' },
  { id: 'p-leo', name: 'Leo Mendoza' },
];
let sampleSeq = 0;
const ms = (projectId: string, title: string, kind: Milestone['kind'], due: number, done = false): Milestone => ({
  id: `ms-${++sampleSeq}`,
  projectId,
  title,
  kind,
  dueDate: dayOffset(due),
  done,
  doneAt: done ? new Date(Date.now() - 86_400_000 * 2).toISOString() : null,
  doneByName: done ? 'Maria Santos' : null,
  position: sampleSeq,
});
const progressOf = (m: Milestone[]) => (m.length ? Math.round((100 * m.filter((x) => x.done).length) / m.length) : 0);

const sample: Project[] = [
  {
    id: 'prj-kristine',
    name: 'Typhoon Kristine relief and early recovery',
    description: 'Food packs, hygiene kits and shelter repair kits for families displaced in Camarines Sur, with a cash-for-work phase for debris clearing.',
    programArea: 'Disaster response',
    status: 'active',
    progress: 0,
    startDate: dayOffset(-20),
    endDate: dayOffset(70),
    leadId: 'p-maria',
    leadName: 'Maria Santos',
    partner: 'Partner Church Network',
    donor: 'Relief Foundation',
    location: 'Naga City and Pili, Camarines Sur',
    beneficiariesTarget: 4500,
    beneficiariesAdditional: 320,
    members: [
      { profileId: 'p-maria', name: 'Maria Santos', role: 'lead' },
      { profileId: 'p-jun', name: 'Jun Dela Cruz', role: 'member' },
      { profileId: demoProfile.id, name: demoProfile.displayName, role: 'member' },
    ],
    milestones: [],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prj-livelihood',
    name: 'Sari-sari store livelihood grants',
    description: 'Small grants, coaching and record-keeping training for 60 women-led households.',
    programArea: 'Livelihood',
    status: 'active',
    progress: 0,
    startDate: dayOffset(-120),
    endDate: dayOffset(45),
    leadId: 'p-ana',
    leadName: 'Ana Reyes',
    partner: null,
    donor: 'Community Grants Fund',
    location: 'Quezon City',
    beneficiariesTarget: 60,
    beneficiariesAdditional: 0,
    members: [
      { profileId: 'p-ana', name: 'Ana Reyes', role: 'lead' },
      { profileId: 'p-leo', name: 'Leo Mendoza', role: 'member' },
    ],
    milestones: [],
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: 'prj-prep',
    name: 'School-based disaster preparedness',
    description: 'Earthquake and fire drills, go-bags and family preparedness plans in five public schools.',
    programArea: 'Disaster preparedness',
    status: 'planned',
    progress: 0,
    startDate: dayOffset(30),
    endDate: dayOffset(150),
    leadId: null,
    leadName: null,
    partner: 'Division schools office',
    donor: null,
    location: 'Quezon City',
    beneficiariesTarget: 2500,
    beneficiariesAdditional: 0,
    members: [],
    milestones: [],
    updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
];
sample[0].milestones = [
  ms('prj-kristine', 'Rapid needs assessment', 'milestone', -15, true),
  ms('prj-kristine', 'First food pack distribution', 'milestone', -8, true),
  ms('prj-kristine', 'Situation report to partners', 'report', 2),
  ms('prj-kristine', 'Shelter repair kits handed out', 'milestone', 14),
  ms('prj-kristine', 'Final donor report', 'report', 80),
];
sample[1].milestones = [
  ms('prj-livelihood', 'Beneficiary selection', 'milestone', -100, true),
  ms('prj-livelihood', 'Grants released', 'milestone', -60, true),
  ms('prj-livelihood', 'Mid-term monitoring visit', 'milestone', -3),
  ms('prj-livelihood', 'Quarterly report', 'report', 20),
];
for (const p of sample) p.progress = progressOf(p.milestones);

const later = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));
const need = () => {
  if (!demoCanManage()) throw new ProjectRuleError('Only coordinators, admins and the project lead can change this.');
};
const touch = (id: string) => {
  const p = sample.find((x) => x.id === id);
  if (p) {
    p.progress = p.milestones.length ? progressOf(p.milestones) : p.progress;
    p.updatedAt = new Date().toISOString();
  }
};

export const mockProjectsService: ProjectsService = {
  source: 'mock',
  async list() {
    return later(structuredClone(sample));
  },
  async save(d) {
    need();
    validate(d);
    const lead = SAMPLE_PEOPLE.find((x) => x.id === d.leadId);
    const fields = {
      name: d.name.trim(),
      description: d.description.trim() || null,
      programArea: d.programArea.trim() || null,
      status: d.status,
      startDate: d.startDate,
      endDate: d.endDate,
      leadId: d.leadId,
      leadName: lead?.name ?? null,
      partner: d.partner.trim() || null,
      donor: d.donor.trim() || null,
      location: d.location.trim() || null,
      beneficiariesTarget: d.beneficiariesTarget,
      beneficiariesAdditional: d.beneficiariesAdditional,
      updatedAt: new Date().toISOString(),
    };
    if (d.id) {
      Object.assign(sample.find((p) => p.id === d.id)!, fields);
      return later(d.id);
    }
    const id = `prj-${Date.now()}`;
    sample.unshift({ id, progress: 0, members: [], milestones: [], ...fields });
    return later(id);
  },
  async setStatus(id, status) {
    need();
    sample.find((p) => p.id === id)!.status = status;
    touch(id);
    await later(null);
  },
  async setPeople(id, target, additional) {
    need();
    checkPeople(target, additional);
    Object.assign(sample.find((p) => p.id === id)!, { beneficiariesTarget: target, beneficiariesAdditional: additional });
    touch(id);
    await later(null);
  },
  async addMember(projectId, profileId) {
    need();
    const p = sample.find((x) => x.id === projectId)!;
    if (!p.members.some((m) => m.profileId === profileId)) p.members.push({ profileId, name: SAMPLE_PEOPLE.find((x) => x.id === profileId)?.name ?? 'Staff member', role: 'member' });
    await later(null);
  },
  async removeMember(projectId, profileId) {
    need();
    const p = sample.find((x) => x.id === projectId)!;
    p.members = p.members.filter((m) => m.profileId !== profileId);
    await later(null);
  },
  async addMilestone(projectId, m) {
    need();
    if (!m.title.trim()) throw new ProjectRuleError('Give it a title.');
    sample.find((x) => x.id === projectId)!.milestones.push({ ...ms(projectId, m.title.trim(), m.kind, 0), dueDate: m.dueDate });
    touch(projectId);
    await later(null);
  },
  async setMilestoneDone(id, done) {
    const p = sample.find((x) => x.milestones.some((m) => m.id === id))!;
    p.milestones = p.milestones.map((m) => (m.id === id ? { ...m, done, doneAt: done ? new Date().toISOString() : null, doneByName: done ? demoProfile.displayName : null } : m));
    touch(p.id);
    await later(null);
  },
  async removeMilestone(id) {
    need();
    const p = sample.find((x) => x.milestones.some((m) => m.id === id))!;
    p.milestones = p.milestones.filter((m) => m.id !== id);
    touch(p.id);
    await later(null);
  },
  async activity(projectId) {
    const p = sample.find((x) => x.id === projectId);
    return later(
      (p?.milestones ?? [])
        .filter((m) => m.done)
        .map((m, i) => ({ id: i + 1, at: m.doneAt!, who: m.doneByName ?? 'Someone', summary: `${m.doneByName} ${m.kind === 'report' ? 'submitted' : 'completed'} “${m.title}”` })),
    );
  },
  async people() {
    return later(SAMPLE_PEOPLE);
  },
};
