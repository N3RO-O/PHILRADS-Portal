import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useLayoutContext } from '../components/layout/AppLayout';
import { DeadlineCalendar } from '../components/dashboard/DeadlineCalendar';
import { MyTasks } from '../components/dashboard/MyTasks';
import { OngoingProjects } from '../components/dashboard/OngoingProjects';
import { QuickActions } from '../components/dashboard/QuickActions';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { ResponseTrend } from '../components/dashboard/ResponseTrend';
import { StockLevels } from '../components/dashboard/StockLevels';
import { SummaryStats } from '../components/dashboard/SummaryStats';
import { VerseOfTheDay } from '../components/dashboard/VerseOfTheDay';
import { WelcomeCard } from '../components/dashboard/WelcomeCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { dashboardService } from '../services';

/**
 * Layout by width:
 *  - phones/tablets: one column, ordered by what staff need first (`order-*`)
 *  - lg: two balanced columns (CSS multi-column)
 *  - xl: three columns — profile & actions | overview & work | activity & stock
 * Column wrappers use `display: contents` below xl so their children join the outer flow.
 */
function Slot({ order, step, children }: { order: string; step: number; children: ReactNode }) {
  // Cards rise in one after another (55 ms apart) for a smooth first impression.
  return (
    <div className={`${order} animate-fade-up break-inside-avoid lg:mb-5 xl:order-none xl:mb-0`} style={{ animationDelay: `${step * 55}ms` }}>
      {children}
    </div>
  );
}

const columnClass = 'contents xl:flex xl:flex-col xl:gap-5';

export function HomePage() {
  const { search } = useLayoutContext();
  const query = search.trim().toLowerCase();
  const tasks = useAsyncData(() => dashboardService.getMyTasks());
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="flex flex-col gap-5 lg:block lg:columns-2 lg:gap-5 xl:grid xl:grid-cols-12 xl:items-start">
      <div className={`${columnClass} xl:col-span-3`}>
        <Slot order="order-1" step={0}>
          <WelcomeCard />
        </Slot>
        <Slot order="order-3" step={3}>
          <QuickActions />
        </Slot>
        <Slot order="order-8" step={6}>
          <VerseOfTheDay />
        </Slot>
      </div>
      <div className={`${columnClass} xl:col-span-6`}>
        <Slot order="order-2" step={1}>
          <SummaryStats />
        </Slot>
        <Slot order="order-6" step={4}>
          <OngoingProjects />
        </Slot>
        <Slot order="order-4" step={5}>
          <MyTasks tasks={tasks} search={query} />
        </Slot>
        <Slot order="order-5" step={7}>
          <DeadlineCalendar tasks={tasks} />
        </Slot>
      </div>
      <div className={`${columnClass} xl:col-span-3`}>
        <Slot order="order-7" step={2}>
          <RecentActivity search={query} />
        </Slot>
        <Slot order="order-9" step={5}>
          <StockLevels />
        </Slot>
        <Slot order="order-10" step={8}>
          <ResponseTrend />
        </Slot>
      </div>
    </div>
  );
}
