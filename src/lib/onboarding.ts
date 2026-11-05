import type { PermissionKey } from '../config/permissions';

/**
 * First-run ("Get started") model. Five pieces:
 *  1. one question before anything else (what will you mostly do?) — shapes the order of the steps;
 *  2. a checklist that opens with one step already done (signing in);
 *  3. empty lists always offer a next action (see the pages);
 *  4. one coach mark, near the thumb on phones, shown once;
 *  5. "Skip for now" that remembers: the list hides, progress is kept and steps still tick.
 */

export type StepId = 'signin' | 'task' | 'stock' | 'file' | 'map' | 'invite' | 'search' | 'profile' | 'unlock' | 'notify' | 'install';
export type Focus = 'task' | 'stock' | 'file' | 'map' | 'invite';

export interface OnboardingState {
  focus?: Focus;
  /** The one question: answered or skipped (either way it isn't asked again). */
  question?: 'answered' | 'skipped';
  /** "Skip for now" on the checklist. */
  hidden?: boolean;
  coachSeen?: boolean;
  /** When each step was done (ISO time). */
  steps: Partial<Record<StepId, string>>;
}

export type OnboardingPatch = Partial<Omit<OnboardingState, 'steps'>> & { steps?: Partial<Record<StepId, string>> };

export interface StepDef {
  id: StepId;
  label: string;
  /** One line on why it matters, shown under the label. */
  why: string;
  /** Button text, and where it goes, or what it opens right here (install, phone alerts, quick unlock, search). */
  action: string;
  to: string | 'install' | 'notify' | 'unlock' | 'search';
  permission?: PermissionKey;
}

export const STEPS: StepDef[] = [
  { id: 'signin', label: 'Sign in to the portal', why: 'Done. Your account is ready.', action: '', to: '/' },
  { id: 'task', label: 'Plan your first task', why: 'Type what you’ll do and press Enter. It lands in Today.', action: 'Add a task', to: '/tasks?view=myday' },
  { id: 'stock', label: 'Check what’s in stock', why: 'Live from PHILRADS IMS: what’s low, expiring or waiting for approval.', action: 'Open Inventory', to: '/inventory', permission: 'inventory.read' },
  { id: 'file', label: 'Find a form or file', why: 'Forms, policies and manuals from Google Drive, in one place.', action: 'Open Resources', to: '/resources', permission: 'resources.read' },
  { id: 'map', label: 'See where we’ve worked', why: 'Projects, warehouses and the team in the field on the Live Map.', action: 'Open Live Map', to: '/live-map', permission: 'map.read' },
  { id: 'invite', label: 'Invite a teammate', why: 'They get an email to choose a password. You choose what they can do.', action: 'Invite someone', to: '/staff?invite=1', permission: 'staff.manage' },
  { id: 'search', label: 'Search anything', why: 'Tasks, stock, places, people and forms from one box. Ctrl K on a computer.', action: 'Try it', to: 'search' },
  { id: 'profile', label: 'Add your photo', why: 'So the team knows you in Active. You choose who sees your details.', action: 'Open profile', to: '/profile' },
  { id: 'unlock', label: 'Set up quick unlock', why: 'A PIN or your fingerprint opens the portal, no password each time.', action: 'Set up', to: 'unlock' },
  { id: 'notify', label: 'Get task alerts on this device', why: 'New tasks, nudges and answers pop up even when the portal is closed.', action: 'Turn on', to: 'notify' },
  { id: 'install', label: 'Put the portal on your phone', why: 'Opens like an app and keeps working with a weak signal.', action: 'Install', to: 'install' },
];

export const FOCUS_OPTIONS: { focus: Focus; label: string; note: string; permission?: PermissionKey }[] = [
  { focus: 'task', label: 'Plan and follow up my work', note: 'Tasks, today’s plan and deadlines' },
  { focus: 'stock', label: 'Track and approve relief stock', note: 'Inventory from PHILRADS IMS', permission: 'inventory.read' },
  { focus: 'file', label: 'Find forms and files', note: 'Resources from Google Drive', permission: 'resources.read' },
  { focus: 'map', label: 'Follow our projects and field team', note: 'The Live Map', permission: 'map.read' },
  { focus: 'invite', label: 'Bring my team in', note: 'Invite staff and volunteers', permission: 'staff.manage' },
];

export const FOCUS_STEP: Record<Focus, StepId> = { task: 'task', stock: 'stock', file: 'file', map: 'map', invite: 'invite' };

/** The steps this person sees: allowed by their role, signing in first, their answer next. */
export function stepsFor(state: OnboardingState, can: (p: PermissionKey) => boolean): StepDef[] {
  const allowed = STEPS.filter((s) => !s.permission || can(s.permission));
  const first = state.focus ? FOCUS_STEP[state.focus] : null;
  return [...allowed].sort((a, b) => rank(a.id, first) - rank(b.id, first));
}
const rank = (id: StepId, first: StepId | null) => (id === 'signin' ? -2 : id === first ? -1 : STEPS.findIndex((s) => s.id === id));

/** Same merge as update_onboarding() in the database: flags replace, steps add up. */
export function mergeOnboarding(a: OnboardingState, b: OnboardingPatch): OnboardingState {
  const { steps, ...rest } = b;
  return { ...a, ...rest, steps: { ...a.steps, ...steps } };
}

/** Combine what the server and this device know (a step done on either counts). */
export function unionOnboarding(server: OnboardingState, local: OnboardingState): OnboardingState {
  return {
    focus: server.focus ?? local.focus,
    question: server.question ?? local.question,
    hidden: server.hidden ?? local.hidden,
    coachSeen: server.coachSeen || local.coachSeen || undefined,
    steps: { ...local.steps, ...server.steps },
  };
}

export const emptyOnboarding = (): OnboardingState => ({ steps: {} });
