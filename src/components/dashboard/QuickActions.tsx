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
      <ul className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
        {ACTIONS.map(({ to, label, icon: Icon }) => (
          <li key={label}>
            <Link
              to={to}
              className="flex h-full min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl bg-cloud px-2 py-3 text-center text-xs font-semibold leading-tight transition-colors hover:bg-burgundy-50"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-burgundy ring-1 ring-black/5">
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
