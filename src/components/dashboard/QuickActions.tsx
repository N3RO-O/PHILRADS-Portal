import { Link } from 'react-router-dom';
import { FolderKanban, Map, PackagePlus, Plus, Printer, Upload } from 'lucide-react';
import { Card } from '../ui/Card';

const ACTIONS = [
  { to: '/tasks?action=create-task', label: 'Create task', icon: Plus },
  { to: '/inventory?action=add-inventory', label: 'Add inventory record', icon: PackagePlus },
  { to: '/documentation?action=upload', label: 'Upload documentation', icon: Upload },
  { to: '/live-map', label: 'View live map', icon: Map },
  { to: '/projects', label: 'Open projects', icon: FolderKanban },
  { to: '/print-docs?action=create-print', label: 'Create print document', icon: Printer },
];

export function QuickActions() {
  return (
    <Card id="quick-actions" title="Quick actions" note="Shortcuts to common work">
      {/* 3 columns only where tiles are wide enough for "documentation"; the narrow xl side column uses 2. */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
        {ACTIONS.map(({ to, label, icon: Icon }) => (
          <li key={label}>
            <Link
              to={to}
              className="glass-inset group flex h-full min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl px-2 py-3 text-center text-xs font-semibold leading-tight transition duration-200 hover:-translate-y-0.5 hover:bg-white/90"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-b from-white to-burgundy-50 text-burgundy shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(100,6,6,0.1),0_4px_10px_-6px_rgba(100,6,6,0.45)] transition group-hover:scale-105">
                <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
