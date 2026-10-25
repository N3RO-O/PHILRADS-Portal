import { createPortal } from 'react-dom';
import { formatLongDate, formatNumber } from '../../lib/format';
import type { Level } from '../../lib/taskProgress';

/**
 * Certificate of Recognition for reaching a milestone level (5 and 10). Rendered outside the app
 * and shown only when printing, like the inventory report (Print → Save as PDF).
 */
export function Certificate({ name, level, tasksDone }: { name: string; level: Level; tasksDone: number }) {
  return createPortal(
    <div className="print-certificate">
      <div className="frame">
        <p className="org">PHILRADS</p>
        <p className="org-sub">Philippine Relief and Development Services, Inc.</p>
        <h1>Certificate of Recognition</h1>
        <p className="lead">This is presented to</p>
        <p className="name">{name}</p>
        <p className="body">
          for reaching <strong>Level {level.level} · {level.title}</strong> in the PHILRADS Staff Portal, having faithfully completed{' '}
          {formatNumber(tasksDone)} tasks in service of families and communities in need.
        </p>
        <p className="date">Given on {formatLongDate()}</p>
        <div className="signatures">
          <span>Executive Director</span>
          <span>Program Coordinator</span>
        </div>
        <p className="motto">Serving People in Jesus’ Name</p>
      </div>
    </div>,
    document.body,
  );
}
