import {
  ClipboardCheck,
  FileText,
  FolderKanban,
  House,
  Library,
  LifeBuoy,
  Map,
  Package,
  Printer,
  ScrollText,
  SquareCheckBig,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleId } from '../types';
import type { PermissionKey } from './permissions';

export type NavGroup = 'Overview' | 'Field operations' | 'Work' | 'Admin';

export interface ModuleConfig {
  id: ModuleId;
  label: string;
  path: string;
  icon: LucideIcon;
  group: NavGroup;
  /** One-sentence purpose, shown on the placeholder page. */
  summary: string;
  /** Planned scope for the module, shown until it is built. */
  plannedScope: string[];
  /** Shown in the navigation only to staff with this permission. */
  permission?: PermissionKey;
}

/** The nine portal modules, in the order PHILRADS specified. */
export const MODULES: ModuleConfig[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    icon: House,
    group: 'Overview',
    summary: 'Your dashboard.',
    plannedScope: [],
  },
  {
    id: 'live-map',
    label: 'Live Map',
    path: '/live-map',
    icon: Map,
    group: 'Field operations',
    summary: 'Warehouses, response sites and the team in the field on one map, with live stock and people served.',
    plannedScope: [],
  },
  {
    id: 'inventory',
    label: 'Inventory Management',
    path: '/inventory',
    icon: Package,
    group: 'Field operations',
    summary: 'Track relief goods across warehouses and field hubs, with every receipt, release and transfer recorded.',
    plannedScope: ['Item catalogue and stock on hand per location', 'Inventory movements with who recorded them', 'Reorder-level alerts'],
  },
  {
    id: 'pdm',
    label: 'PDM',
    path: '/pdm',
    icon: ClipboardCheck,
    group: 'Field operations',
    summary: 'The PDM workspace. Its scope and full name will be set once PHILRADS confirms the module definition.',
    plannedScope: ['Scope to be confirmed by PHILRADS'],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    path: '/documentation',
    icon: FileText,
    group: 'Field operations',
    summary: 'Upload photos, videos, PDFs and reports to the right Google Drive folder, with each file’s record kept in the portal.',
    plannedScope: [
      'Uploads to module- and project-specific Drive folders',
      'Document category, file type and upload progress',
      'Access limited to authorised staff, no public links by default',
    ],
  },
  {
    id: 'response',
    label: 'Response',
    path: '/response',
    icon: LifeBuoy,
    group: 'Field operations',
    summary: 'Log and coordinate disaster response, from rapid needs assessment to distribution and reporting.',
    plannedScope: ['Response operations and activity logs', 'Assessments and distributions', 'Links to inventory and documentation'],
  },
  {
    id: 'projects',
    label: 'Projects',
    path: '/projects',
    icon: FolderKanban,
    group: 'Work',
    summary: 'Follow each program and project with its milestones, deadlines and team.',
    plannedScope: ['Project list with status and milestones', 'Deadlines and reporting dates', 'Related tasks, documents and activities'],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    path: '/tasks',
    icon: SquareCheckBig,
    group: 'Work',
    summary: 'Create, assign and track tasks across teams and modules.',
    plannedScope: ['Create and assign tasks', 'Priorities, due dates and status', 'Your tasks and your team’s tasks'],
  },
  {
    id: 'print-docs',
    label: 'Print Docs',
    path: '/print-docs',
    icon: Printer,
    group: 'Work',
    summary: 'Create printable documents, such as forms and acknowledgement receipts, from approved templates.',
    plannedScope: ['Approved document templates', 'Fill from portal records', 'Print-ready layouts'],
  },
  {
    id: 'resources',
    label: 'Resources',
    path: '/resources',
    icon: Library,
    group: 'Work',
    summary: 'Forms, policies, manuals, reports and brand files staff can open or download, kept in Google Drive.',
    plannedScope: [],
  },
  {
    id: 'staff',
    label: 'Staff & volunteers',
    path: '/staff',
    icon: UsersRound,
    group: 'Admin',
    summary: 'Invite staff and volunteers to the portal, choose what each person can do, and switch accounts on or off.',
    plannedScope: [],
    permission: 'staff.manage',
  },
  {
    id: 'logs',
    label: 'Logs',
    path: '/logs',
    icon: ScrollText,
    group: 'Admin',
    summary: 'Everything that happens in the portal: tasks, stock, staff changes and sign-ins, with flags to look into. Nobody can change or delete it.',
    plannedScope: [],
    permission: 'audit.read',
  },
];

export const NAV_GROUPS: NavGroup[] = ['Overview', 'Field operations', 'Work', 'Admin'];

export const moduleById = (id: ModuleId) => MODULES.find((m) => m.id === id)!;

export const moduleForPath = (pathname: string): ModuleConfig | undefined =>
  pathname === '/' ? moduleById('home') : MODULES.find((m) => m.path !== '/' && pathname.startsWith(m.path));
