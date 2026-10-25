import {
  Award,
  Briefcase,
  Building2,
  ClipboardList,
  Clock,
  FileText,
  Flame,
  Footprints,
  GraduationCap,
  Handshake,
  HeartHandshake,
  MapPin,
  Search,
  Sparkles,
  Sun,
  Truck,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Badge, Frame } from '../../lib/taskProgress';
import type { TaskList } from '../../services/tasks/types';

/** Icon and colour for each task list: the dot, the checkbox ring and the list's chip. */
export const LIST_STYLE: Record<TaskList, { icon: LucideIcon; text: string; ring: string; soft: string }> = {
  relief: { icon: HeartHandshake, text: 'text-emerald-300', ring: 'border-emerald-300/70', soft: 'bg-emerald-300/10' },
  assessment: { icon: ClipboardList, text: 'text-sky-300', ring: 'border-sky-300/70', soft: 'bg-sky-300/10' },
  logistics: { icon: Truck, text: 'text-amber-300', ring: 'border-amber-300/70', soft: 'bg-amber-300/10' },
  beneficiaries: { icon: Users, text: 'text-violet-300', ring: 'border-violet-300/70', soft: 'bg-violet-300/10' },
  reports: { icon: FileText, text: 'text-rose', ring: 'border-rose/70', soft: 'bg-rose/10' },
  volunteers: { icon: GraduationCap, text: 'text-teal-300', ring: 'border-teal-300/70', soft: 'bg-teal-300/10' },
  coordination: { icon: Handshake, text: 'text-indigo-300', ring: 'border-indigo-300/70', soft: 'bg-indigo-300/10' },
  office: { icon: Briefcase, text: 'text-slate-300', ring: 'border-slate-300/70', soft: 'bg-slate-300/10' },
};

export const BADGE_ICON: Record<Badge['icon'], LucideIcon> = {
  footprints: Footprints,
  mapPin: MapPin,
  building: Building2,
  heartHandshake: HeartHandshake,
  search: Search,
  truck: Truck,
  fileText: FileText,
  graduationCap: GraduationCap,
  clock: Clock,
  zap: Zap,
  users: Users,
  flame: Flame,
  sun: Sun,
  award: Award,
  sparkles: Sparkles,
};

/** Profile ring unlocked by level (bronze at 3, silver 5, gold 7, platinum 10). */
export const FRAME_RING: Record<Frame, string> = {
  none: 'ring-line',
  bronze: 'ring-[#c98a55]',
  silver: 'ring-[#c9ced6]',
  gold: 'ring-[#e9b949]',
  platinum: 'ring-[#a8e3f0]',
};
export const FRAME_TEXT: Record<Frame, string> = {
  none: 'text-ink-soft',
  bronze: 'text-[#d9a273]',
  silver: 'text-[#d7dbe2]',
  gold: 'text-[#f0c862]',
  platinum: 'text-[#b9ecf6]',
};
