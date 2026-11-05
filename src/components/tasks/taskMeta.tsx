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

/**
 * Icon for each task list. Lists are told apart by icon and name, not colour (docs/design-system.md),
 * so every list shares the same neutral text, checkbox ring and chip.
 */
const N = { text: 'text-ink-soft', ring: 'border-ink-mute', soft: 'bg-surface-raised' } as const;
export const LIST_STYLE: Record<TaskList, { icon: LucideIcon; text: string; ring: string; soft: string }> = {
  relief: { icon: HeartHandshake, text: N.text, ring: N.ring, soft: N.soft },
  assessment: { icon: ClipboardList, text: N.text, ring: N.ring, soft: N.soft },
  logistics: { icon: Truck, text: N.text, ring: N.ring, soft: N.soft },
  beneficiaries: { icon: Users, text: N.text, ring: N.ring, soft: N.soft },
  reports: { icon: FileText, text: N.text, ring: N.ring, soft: N.soft },
  volunteers: { icon: GraduationCap, text: N.text, ring: N.ring, soft: N.soft },
  coordination: { icon: Handshake, text: N.text, ring: N.ring, soft: N.soft },
  office: { icon: Briefcase, text: N.text, ring: N.ring, soft: N.soft },
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
