import type { Kudos, Task, TaskList, WeekBonus, XpAward } from '../services/tasks/types';
import { addDays, daysBetween } from './tasks';
import { todayKey } from './inventory';
import { manilaDayKey } from './format';

/**
 * Levels, badges and rewards for the Tasks module.
 * XP rules mirror award_task_xp() in supabase/migrations/20261028000000_task_fairness_and_audit.sql:
 * the database awards XP for real; this copy scores sample mode and explains the rules.
 */
export const XP_RULES = {
  /** Tasks someone else gave you, by the priority they set. */
  base: { low: 10, medium: 20, high: 35 },
  /** Tasks you set for yourself: one flat amount (no priority, on-time or subtask extras). */
  self: 10,
  onTime: 10,
  perSubtask: 2,
  maxSubtasks: 10,
  /** Most XP a day from tasks people set for themselves. */
  selfDailyCap: 60,
  kudos: 15,
  /** A photo sent with a task that didn't need one. */
  photo: 5,
  /** A task finished on every working day (Monday to Friday) of a week. */
  fullWeek: 50,
  /** Finishing the Get started checklist, once. */
  onboarding: 50,
} as const;

/** Score a finished task (sample mode). `selfXpToday`: XP already earned today from self-set tasks. */
export function scoreCompletion(task: Task, earnerId: string, selfXpToday: number, today = todayKey(), withPhoto = false): XpAward {
  const selfSet = task.createdById === earnerId;
  const base = selfSet ? XP_RULES.self : XP_RULES.base[task.priority];
  const onTime = !selfSet && task.dueDate && today <= task.dueDate ? XP_RULES.onTime : 0;
  const subtasks = selfSet ? 0 : Math.min(XP_RULES.maxSubtasks, XP_RULES.perSubtask * task.subtasks.filter((s) => s.done).length);
  const photo = withPhoto && !task.requiresPhoto ? XP_RULES.photo : 0;
  let points = base + onTime + subtasks + photo;
  let capped = false;
  if (selfSet && points > Math.max(0, XP_RULES.selfDailyCap - selfXpToday)) {
    points = Math.max(0, XP_RULES.selfDailyCap - selfXpToday);
    capped = true;
  }
  return { taskId: task.id, taskTitle: task.title, points, base, onTime, subtasks, photo, selfSet, capped, flag: null, day: today, awardedAt: new Date().toISOString() };
}

/** What finishing a task is worth before any cap: shown on the task. Your own tasks are worth a flat amount. */
export const taskWorth = (task: Pick<Task, 'priority' | 'dueDate' | 'subtasks'>, selfSet = false) =>
  selfSet ? XP_RULES.self : XP_RULES.base[task.priority] + Math.min(XP_RULES.maxSubtasks, XP_RULES.perSubtask * task.subtasks.filter((s) => s.done).length);

// ───────────────────────── Levels and unlocks ─────────────────────────

export type Frame = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Level {
  level: number;
  /** XP needed to reach it. */
  xp: number;
  title: string;
  frame?: Exclude<Frame, 'none'>;
  certificate?: boolean;
}

export const LEVELS: Level[] = [
  { level: 1, xp: 0, title: 'Newcomer' },
  { level: 2, xp: 100, title: 'Helper' },
  { level: 3, xp: 300, title: 'Contributor', frame: 'bronze' },
  { level: 4, xp: 600, title: 'Responder' },
  { level: 5, xp: 1000, title: 'Steady Hand', frame: 'silver', certificate: true },
  { level: 6, xp: 1600, title: 'Bridge Builder' },
  { level: 7, xp: 2400, title: 'Lifeline', frame: 'gold' },
  { level: 8, xp: 3400, title: 'Beacon' },
  { level: 9, xp: 4700, title: 'Servant Leader' },
  { level: 10, xp: 6500, title: 'Pillar of PHILRADS', frame: 'platinum', certificate: true },
];

export const FRAME_LABEL: Record<Exclude<Frame, 'none'>, string> = {
  bronze: 'Bronze profile ring',
  silver: 'Silver profile ring',
  gold: 'Gold profile ring',
  platinum: 'Platinum profile ring',
};

export function levelFor(xp: number) {
  const current = [...LEVELS].reverse().find((l) => xp >= l.xp) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null;
  const frame: Frame = [...LEVELS].reverse().find((l) => l.level <= current.level && l.frame)?.frame ?? 'none';
  return {
    ...current,
    frame,
    next,
    /** 0–1 towards the next level (1 at the top level). */
    progress: next ? (xp - current.xp) / (next.xp - current.xp) : 1,
    toNext: next ? next.xp - xp : 0,
  };
}

// ───────────────────────── Badges ─────────────────────────

export interface TaskStats {
  total: number;
  field: number;
  office: number;
  byList: Record<TaskList, number>;
  onTime: number;
  /** High-priority tasks finished within a day of being added. */
  rapidHigh: number;
  /** Given by someone else. */
  fromOthers: number;
  /** Finished on the day they were planned for. */
  planned: number;
  streak: number;
  bestStreak: number;
  kudos: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  /** lucide icon name, mapped in the component. */
  icon: 'footprints' | 'mapPin' | 'building' | 'heartHandshake' | 'search' | 'truck' | 'fileText' | 'graduationCap' | 'clock' | 'zap' | 'users' | 'flame' | 'sun' | 'award' | 'sparkles';
  target: number;
  value: (s: TaskStats) => number;
}

export const BADGES: Badge[] = [
  { id: 'first-step', name: 'First step', description: 'Finish your first task', icon: 'footprints', target: 1, value: (s) => s.total },
  { id: 'boots', name: 'Boots on the ground', description: 'Finish 10 field tasks', icon: 'mapPin', target: 10, value: (s) => s.field },
  { id: 'backbone', name: 'Backbone of the office', description: 'Finish 10 office tasks', icon: 'building', target: 10, value: (s) => s.office },
  { id: 'relief', name: 'First responder', description: 'Finish 10 emergency response tasks', icon: 'heartHandshake', target: 10, value: (s) => s.byList.emergency },
  { id: 'assessor', name: 'Eyes on the ground', description: 'Finish 5 monitoring and coordination tasks', icon: 'search', target: 5, value: (s) => s.byList.monitoring },
  { id: 'supply', name: 'Rebuilder', description: 'Finish 5 rehabilitation and recovery tasks', icon: 'building', target: 5, value: (s) => s.byList.rehabilitation },
  { id: 'records', name: 'Change maker', description: 'Finish 5 sustainable livelihood or special project tasks', icon: 'sparkles', target: 5, value: (s) => s.byList.livelihood + s.byList.special },
  { id: 'mentor', name: 'Mentor', description: 'Finish 5 training and capacity building tasks', icon: 'graduationCap', target: 5, value: (s) => s.byList.training },
  { id: 'on-time', name: 'On the dot', description: 'Finish 10 tasks on or before their due date', icon: 'clock', target: 10, value: (s) => s.onTime },
  { id: 'rapid', name: 'Rapid response', description: 'Finish 3 high-priority tasks within a day of adding them', icon: 'zap', target: 3, value: (s) => s.rapidHigh },
  { id: 'team', name: 'Team player', description: 'Finish 5 tasks someone else gave you', icon: 'users', target: 5, value: (s) => s.fromOthers },
  { id: 'planner', name: 'Day planner', description: 'Finish 10 tasks on the day you planned to do them', icon: 'sun', target: 10, value: (s) => s.planned },
  { id: 'steady', name: 'Seven-day streak', description: 'Finish at least one task 7 days in a row', icon: 'flame', target: 7, value: (s) => s.bestStreak },
  { id: 'thanked', name: 'Thanked', description: 'Receive kudos from a coordinator', icon: 'sparkles', target: 1, value: (s) => s.kudos },
  { id: 'hundred', name: 'Hundred strong', description: 'Finish 100 tasks', icon: 'award', target: 100, value: (s) => s.total },
];

// ───────────────────────── The working week ─────────────────────────

/** 0 = Monday … 6 = Sunday, for a YYYY-MM-DD day. */
const weekday = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
export const mondayOf = (day: string) => addDays(day, -weekday(day));

/** Weeks with a finished task on every day Monday to Friday (the database's rule, for sample mode). */
export function weekBonusesFrom(awards: XpAward[]): WeekBonus[] {
  const weeks = new Map<string, Set<number>>();
  for (const a of awards) {
    if (a.flag || weekday(a.day) > 4) continue;
    const w = mondayOf(a.day);
    weeks.set(w, (weeks.get(w) ?? new Set()).add(weekday(a.day)));
  }
  return [...weeks].filter(([, d]) => d.size === 5).map(([weekStart]) => ({ weekStart, points: XP_RULES.fullWeek }));
}

/** This week, Monday to Sunday: which days had a finished task. */
export function weekCircles(awards: XpAward[], today: string, bonuses: WeekBonus[] = []) {
  const monday = mondayOf(today);
  const doneDays = new Set(awards.filter((a) => !a.flag).map((a) => a.day));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return { day, done: doneDays.has(day), today: day === today, future: day > today, weekend: i > 4 };
  });
  const workDone = days.filter((d) => !d.weekend && d.done).length;
  return { monday, days, workDone, bonus: bonuses.some((b) => b.weekStart === monday) || workDone === 5 };
}

// ───────────────────────── Putting it together ─────────────────────────

/** Days in a row with at least one finished task, ending today (or yesterday: today isn't over). */
function streaks(days: Set<string>, today: string) {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && daysBetween(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  let current = 0;
  let day = days.has(today) ? today : addDays(today, -1);
  while (days.has(day)) {
    current++;
    day = addDays(day, -1);
  }
  return { current, best };
}

export function computeProgress(input: { awards: XpAward[]; kudos: Kudos[]; weekBonuses?: WeekBonus[]; tasks: Task[]; userId: string | null; today?: string; /** XP from outside tasks (Get started). */ bonusXp?: number }) {
  const today = input.today ?? todayKey();
  const { kudos } = input;
  // Tasks added already finished don't count toward badges or streaks.
  const awards = input.awards.filter((a) => !a.flag);
  const byTask = new Map(input.tasks.map((t) => [t.id, t]));
  const done = awards.map((a) => byTask.get(a.taskId)).filter((t): t is Task => Boolean(t));

  const byList = { emergency: 0, rehabilitation: 0, livelihood: 0, training: 0, special: 0, monitoring: 0 } as Record<TaskList, number>;
  for (const t of done) byList[t.list]++;
  const { current, best } = streaks(new Set(awards.map((a) => a.day)), today);
  const stats: TaskStats = {
    total: awards.length,
    field: done.filter((t) => t.setting === 'field').length,
    office: done.filter((t) => t.setting === 'office').length,
    byList,
    onTime: awards.filter((a) => a.onTime > 0).length,
    rapidHigh: done.filter((t) => t.priority === 'high' && t.completedAt && Date.parse(t.completedAt) - Date.parse(t.createdAt) <= 86_400_000).length,
    fromOthers: awards.filter((a) => !a.selfSet).length,
    planned: done.filter((t) => t.myDay && t.completedAt && manilaDayKey(t.completedAt) === t.myDay).length,
    streak: current,
    bestStreak: best,
    kudos: kudos.length,
  };

  const weekBonuses = input.weekBonuses ?? [];
  const xp = awards.reduce((s, a) => s + a.points, 0) + kudos.reduce((s, k) => s + k.points, 0) + weekBonuses.reduce((s, w) => s + w.points, 0) + (input.bonusXp ?? 0);
  const todays = awards.filter((a) => a.day === today);
  return {
    xp,
    level: levelFor(xp),
    stats,
    todayXp: todays.reduce((s, a) => s + a.points, 0),
    selfXpToday: todays.filter((a) => a.selfSet).reduce((s, a) => s + a.points, 0),
    badges: badgesFor(stats),
    week: weekCircles(awards, today, weekBonuses),
    fullWeeks: weekBonuses.length,
  };
}

/** Each badge with how far along someone is. */
export const badgesFor = (stats: TaskStats) =>
  BADGES.map((b) => {
    const value = b.value(stats);
    return { badge: b, value: Math.min(value, b.target), earned: value >= b.target };
  });

export type Progress = ReturnType<typeof computeProgress>;
