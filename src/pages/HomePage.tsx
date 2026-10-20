import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useLayoutContext } from '../components/layout/AppLayout';
import { DeadlineCalendar } from '../components/dashboard/DeadlineCalendar';
import { MyTasks } from '../components/dashboard/MyTasks';
import { OverviewKpis } from '../components/dashboard/OverviewKpis';
import { ProjectsTable } from '../components/dashboard/ProjectsTable';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { ResponseTrend } from '../components/dashboard/ResponseTrend';
import { StockHealth } from '../components/dashboard/StockHealth';
import { StockLevelsChart } from '../components/dashboard/StockLevelsChart';
import { VerseOfTheDay } from '../components/dashboard/VerseOfTheDay';
import { WelcomeBar } from '../components/dashboard/WelcomeBar';
import { useAsyncData } from '../hooks/useAsyncData';
import { dashboardService } from '../services';

/**
 * Grid by width:
 *  - phones: one column, ordered by what staff need first (`order-*`)
 *  - md–lg: two columns; wide cards span both
 *  - xl: 12 columns in aligned rows, in DOM order:
 *      welcome (12) | overview (8) + stock levels (4) | projects (8) + response (4)
 *      | stock health (4) + my tasks (8) | activity (4) + calendar (4) + verse (4)
 */
function Cell({ className, step, children }: { className: string; step: number; children: ReactNode }) {
  return (
    <div className={`${className} animate-fade-up xl:order-none`} style={{ animationDelay: `${step * 45}ms` }}>
      {children}
    </div>
  );
}

export function HomePage() {
  const { search } = useLayoutContext();
  const query = search.trim().toLowerCase();
  const tasks = useAsyncData(() => dashboardService.getMyTasks());
  const stock = useAsyncData(() => dashboardService.getStockLevels());
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12">
      <Cell className="order-1 md:col-span-2 xl:col-span-12" step={0}>
        <WelcomeBar />
      </Cell>
      <Cell className="order-2 md:col-span-2 xl:col-span-8" step={1}>
        <OverviewKpis />
      </Cell>
      <Cell className="order-8 xl:col-span-4" step={2}>
        <StockLevelsChart stock={stock} />
      </Cell>
      <Cell className="order-6 md:col-span-2 xl:col-span-8" step={3}>
        <ProjectsTable />
      </Cell>
      <Cell className="order-9 xl:col-span-4" step={4}>
        <ResponseTrend />
      </Cell>
      <Cell className="order-10 xl:col-span-4" step={5}>
        <StockHealth stock={stock} />
      </Cell>
      <Cell className="order-3 md:col-span-2 xl:col-span-8" step={6}>
        <MyTasks tasks={tasks} search={query} />
      </Cell>
      <Cell className="order-4 xl:col-span-4" step={7}>
        <RecentActivity search={query} />
      </Cell>
      <Cell className="order-5 xl:col-span-4" step={8}>
        <DeadlineCalendar tasks={tasks} />
      </Cell>
      <Cell className="order-11 xl:col-span-4" step={9}>
        <VerseOfTheDay />
      </Cell>
    </div>
  );
}
