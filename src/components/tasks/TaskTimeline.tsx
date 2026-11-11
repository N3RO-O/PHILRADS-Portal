import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { DoneCheck } from '../ui/DoneCheck';
import './taskTimeline.css';

/** Where a task stands, as the timeline draws it. */
export type Standing = 'done' | 'in_progress' | 'review' | 'todo' | 'overdue';

export interface TimelineItem {
  id: string;
  standing: Standing;
  /** The date pill (already formatted), e.g. "Nov 13". */
  when: string;
  /** Small icon in the card's chip. */
  icon: ReactNode;
  title: ReactNode;
  /** Status, giver and other chips under the title. */
  meta: ReactNode;
  /** Started, finished and how long it took. */
  timing?: ReactNode;
  /** Actions (nudge, accept or decline) at the foot of the card. */
  actions?: ReactNode;
}

/** The line fills down to the last task that is done or under way. */
const reached = (s: Standing) => s === 'done' || s === 'in_progress' || s === 'review';

interface Geometry {
  top: number;
  height: number;
  fill: number;
}

/**
 * A vertical timeline: a rail with a node per task and a card beside it. Cards alternate left and right
 * when the panel is wide enough (a container query), otherwise they sit in one column with the rail on
 * the left. The rail draws down and the cards rise in one after another when it opens.
 */
export function TaskTimeline({ items, label }: { items: TimelineItem[]; label: string }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [geom, setGeom] = useState<Geometry | null>(null);
  const target = items.reduce((last, it, i) => (reached(it.standing) ? i : last), -1);
  const key = items.map((i) => `${i.id}:${i.standing}`).join('|');

  // Measure node centres so the rail runs from the first node to the last, and the fill to the target.
  useLayoutEffect(() => {
    const ol = listRef.current;
    if (!ol) return;
    const measure = () => {
      const nodes = ol.querySelectorAll<HTMLElement>(':scope > li > .tl-node');
      if (nodes.length === 0) return setGeom(null);
      const centre = (n: HTMLElement) => n.offsetTop + n.offsetHeight / 2;
      const top = centre(nodes[0]);
      const height = centre(nodes[nodes.length - 1]) - top;
      const fill = target >= 0 && nodes[target] ? centre(nodes[target]) - top : 0;
      setGeom((g) => (g && g.top === top && g.height === height && g.fill === fill ? g : { top, height, fill }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ol);
    return () => ro.disconnect();
  }, [key, target]);

  return (
    <div className="tl-wrap">
      <ol ref={listRef} className="tl" aria-label={label}>
        {geom && geom.height > 0 && (
          <>
            <span className="tl-rail" style={{ top: geom.top, height: geom.height }} aria-hidden />
            {geom.fill > 0 && <span className="tl-fill" style={{ top: geom.top, height: geom.fill }} aria-hidden />}
          </>
        )}
        {items.map((it, i) => (
          <li key={it.id} className="tl-item" data-s={it.standing} data-side={i % 2 === 0 ? 'l' : 'r'} style={{ '--d': `${120 + i * 70}ms` } as CSSProperties}>
            <span className="tl-node" data-s={it.standing} aria-hidden>
              {it.standing === 'done' ? <DoneCheck className="h-full w-full" /> : it.standing === 'overdue' ? <span className="tl-bang">!</span> : null}
            </span>
            <div className="tl-card">
              <div className="flex items-start gap-2.5">
                <span className="tl-chip" aria-hidden>
                  {it.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <When className="tl-when-in" text={it.when} />
                  {it.title}
                  {it.meta}
                  {it.timing}
                </div>
              </div>
              {it.actions}
            </div>
            <When className="tl-when-side" text={it.when} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function When({ text, className }: { text: string; className: string }) {
  return (
    <span className={`tl-when ${className}`}>
      <Clock className="h-3 w-3" aria-hidden /> {text}
    </span>
  );
}
