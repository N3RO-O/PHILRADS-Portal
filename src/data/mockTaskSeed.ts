/**
 * DEVELOPMENT-ONLY SAMPLE DATA for Tasks: humanitarian work in the field and at the office,
 * with two weeks of finished tasks so levels, streaks and badges have something to show.
 * People other than the demo user are made up.
 */
import { addDays } from '../lib/tasks';
import { scoreCompletion } from '../lib/taskProgress';
import type { TaskPriority } from '../types';
import type { Assignee, Kudos, Recurrence, Task, TaskList, WorkSetting, XpAward } from '../services/tasks/types';

export const SAMPLE_PEOPLE: Assignee[] = [
  { id: 'demo-user', name: 'Demo User' },
  { id: 'demo-maria', name: 'Maria Santos' },
  { id: 'demo-jun', name: 'Jun Dela Cruz' },
  { id: 'demo-ana', name: 'Ana Reyes' },
  { id: 'demo-liza', name: 'Liza Mendoza' },
];
const nameOf = (id: string) => SAMPLE_PEOPLE.find((p) => p.id === id)?.name ?? 'Staff member';

type Open = [
  title: string,
  list: TaskList,
  setting: WorkSetting,
  priority: TaskPriority,
  due: number | null,
  time: string | null,
  extra?: { myDay?: boolean; by?: string; to?: string; location?: string; notes?: string; subtasks?: [string, boolean][]; repeat?: Recurrence },
];

const OPEN: Open[] = [
  ['Morning devotion and team briefing', 'coordination', 'office', 'low', 0, '08:00', { myDay: true, repeat: 'daily' }],
  ['Pack 200 hygiene kits for Guinobatan', 'relief', 'field', 'high', 0, null, {
    myDay: true, by: 'demo-maria', location: 'Main Manila Warehouse',
    subtasks: [['Count soap, toothbrush and sanitary pads', true], ['Seal and label boxes by barangay', false], ['Load onto the 10:30 truck', false]],
  }],
  ['Arrange truck for relief goods to Daraga', 'logistics', 'field', 'high', 0, '14:00', { location: 'Daraga, Albay' }],
  ['Reconcile beneficiary master list with the DSWD list', 'beneficiaries', 'office', 'medium', -1, null, { notes: 'Flag households listed twice and those missing a contact number.' }],
  ['Submit situation report: Typhoon response, day 5', 'reports', 'office', 'high', 1, '17:00', { by: 'demo-maria' }],
  ['Collect signed acknowledgement forms from Brgy. 62', 'reports', 'field', 'low', 1, null, { location: 'Brgy. 62 Sagkahan, Tacloban' }],
  ['Rapid needs assessment in Brgy. Bagong Silangan', 'assessment', 'field', 'medium', 2, '09:00', {
    location: 'Brgy. Bagong Silangan, Quezon City',
    subtasks: [['Print 40 assessment forms', false], ['Brief the 3 enumerators', false]],
  }],
  ['Coordination meeting with the MDRRMO', 'coordination', 'field', 'medium', 3, '10:00', { location: 'Municipal Hall, Guinobatan' }],
  ['Orientation for new volunteers', 'volunteers', 'office', 'medium', 5, '13:30', { repeat: 'weekly' }],
  ['Prepare liquidation report for the September distribution', 'office', 'office', 'medium', 9, null],
  ['Update bin cards at the Cebu Hub', 'logistics', 'office', 'low', null, null],
  ['Plan first-aid refresher for field teams', 'volunteers', 'office', 'low', null, null],
  // Only coordinators and admins see these (someone else's work).
  ['Verify family food packs delivered to Legazpi', 'relief', 'field', 'high', 1, null, { by: 'demo-maria', to: 'demo-jun', location: 'Legazpi Field Drop-off Point' }],
  ['Photograph distribution for the donor report', 'reports', 'field', 'medium', 2, null, { by: 'demo-maria', to: 'demo-ana' }],
];

type Done = [title: string, list: TaskList, setting: WorkSetting, priority: TaskPriority, daysAgo: number, late?: boolean, by?: string];

/** Finished by the demo user over the last two weeks (a 5-day streak up to today). */
const DONE: Done[] = [
  ['Encode 60 household profiles from Brgy. Bagong Silangan', 'beneficiaries', 'office', 'medium', 13],
  ['Weekly stock count, Main Manila Warehouse', 'logistics', 'field', 'medium', 12, false, 'demo-maria'],
  ['Debrief volunteers after the Tacloban distribution', 'volunteers', 'field', 'low', 11],
  ['Draft donor update for Samaritan partners', 'reports', 'office', 'medium', 9, true],
  ['Distribute food packs at Daraga Central School', 'relief', 'field', 'high', 8, false, 'demo-maria'],
  ['Rapid assessment: evacuation centre, Guinobatan', 'assessment', 'field', 'high', 7, false, 'demo-maria'],
  ['Book venue for volunteer training', 'office', 'office', 'low', 6],
  ['Relief distribution: Municipal Hall, Guinobatan', 'relief', 'field', 'high', 4, false, 'demo-maria'],
  ['File acknowledgement forms in the Drive folder', 'reports', 'office', 'low', 4],
  ['Transfer tarpaulins to the Legazpi drop-off point', 'logistics', 'field', 'medium', 3],
  ['Call barangay captains to confirm beneficiary counts', 'coordination', 'office', 'medium', 3],
  ['Repack rice into 5 kg family packs', 'relief', 'field', 'medium', 2, false, 'demo-maria'],
  ['Reply to DSWD data request', 'office', 'office', 'medium', 2, true],
  ['Assessment summary for Brgy. 62', 'assessment', 'office', 'medium', 1],
  ['Train new volunteers on the acknowledgement form', 'volunteers', 'field', 'medium', 1],
  ['Check expiry dates on medicines at the Cebu Hub', 'logistics', 'field', 'high', 0, false, 'demo-maria'],
];

export function createTaskSeed(today: string, userId = 'demo-user'): { tasks: Task[]; awards: XpAward[]; kudos: Kudos[] } {
  const at = (day: string, hhmm = '09:00') => new Date(`${day}T${hhmm}:00+08:00`).toISOString();
  let n = 0;
  const id = () => `task-seed-${++n}`;
  const blank = (title: string, list: TaskList, setting: WorkSetting, priority: TaskPriority, by: string, to: string, created: string): Task => ({
    id: id(),
    title,
    notes: null,
    list,
    setting,
    priority,
    status: 'todo',
    dueDate: null,
    dueTime: null,
    myDay: null,
    subtasks: [],
    recurrence: 'none',
    location: null,
    assigneeId: to,
    assigneeName: nameOf(to),
    createdById: by,
    createdByName: nameOf(by),
    projectId: null,
    completedAt: null,
    createdAt: created,
    updatedAt: created,
  });

  const open = OPEN.map(([title, list, setting, priority, due, time, x = {}]) => {
    const t = blank(title, list, setting, priority, x.by ?? userId, x.to ?? userId, at(addDays(today, -2), '08:30'));
    return {
      ...t,
      notes: x.notes ?? null,
      dueDate: due === null ? null : addDays(today, due),
      dueTime: time,
      myDay: x.myDay ? today : null,
      subtasks: (x.subtasks ?? []).map(([s, d], i) => ({ id: `${t.id}-s${i}`, title: s, done: d })),
      recurrence: x.repeat ?? 'none',
      location: x.location ?? null,
    };
  });

  const awards: XpAward[] = [];
  const done = DONE.map(([title, list, setting, priority, daysAgo, late, by]) => {
    const day = addDays(today, -daysAgo);
    const t: Task = {
      ...blank(title, list, setting, priority, by ?? userId, userId, at(addDays(day, -1), '15:00')),
      status: 'done',
      dueDate: late ? addDays(day, -1) : day,
      myDay: daysAgo % 2 === 0 ? day : null,
      completedAt: at(day, '16:00'),
    };
    const selfToday = awards.filter((a) => a.day === day && a.selfSet).reduce((s, a) => s + a.points, 0);
    awards.push({ ...scoreCompletion(t, userId, selfToday, day), awardedAt: t.completedAt! });
    return t;
  });

  const kudos: Kudos[] = [
    {
      id: 'kudos-seed-1',
      fromName: 'Maria Santos',
      message: 'Thank you for staying late to finish the Guinobatan distribution list. The families were served on time.',
      points: 15,
      createdAt: at(addDays(today, -4), '18:10'),
    },
  ];
  return { tasks: [...open, ...done], awards, kudos };
}
