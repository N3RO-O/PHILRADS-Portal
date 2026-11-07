import { useEffect, useState, type ReactNode } from 'react';
import { GettingStartedBar, GettingStartedCard } from '../components/onboarding/GettingStarted';
import { useOnboarding } from '../components/onboarding/OnboardingProvider';
import { WelcomeQuestion } from '../components/onboarding/WelcomeQuestion';
import { useLocation } from 'react-router-dom';
import { useLayoutContext } from '../components/layout/AppLayout';
import { DeadlineCalendar } from '../components/dashboard/DeadlineCalendar';
import { OverviewKpis } from '../components/dashboard/OverviewKpis';
import { ProjectsTable } from '../components/dashboard/ProjectsTable';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { StockLevelsChart } from '../components/dashboard/StockLevelsChart';
import { TaskBox } from '../components/dashboard/TaskBox';
import { VerseOfTheDay } from '../components/dashboard/VerseOfTheDay';
import { WelcomeBar } from '../components/dashboard/WelcomeBar';
import { useAsyncData } from '../hooks/useAsyncData';
import { dashboardService } from '../services';

/**
 * Grid by width:
 *  - phones: one column, ordered by what staff need first (`order-*`)
 *  - md–lg: two columns; wide cards span both
 *  - xl: 12 columns in aligned rows, in DOM order:
 *      welcome (12) | verse (12) | my tasks (12) | calendar (12) | recent activity, folded (12) | overview (8) + stock levels (4) | projects (12)
 * The calendar has the whole row, so its agenda stays beside it; recent activity opens when clicked.
 * The calendar leads, right after the welcome, at every width.
 * The verse always comes first, at every width (one a day, changing at midnight).
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
  const onboarding = useOnboarding();
  // The one first-run question, asked before anything else (and on request after a skip).
  const [askAgain, setAskAgain] = useState(false);

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <>
    <WelcomeQuestion
      open={onboarding.askQuestion || askAgain}
      onAnswer={(focus) => (onboarding.answer(focus), setAskAgain(false))}
      onSkip={() => (onboarding.state.question ? undefined : onboarding.skipQuestion(), setAskAgain(false))}
    />
    <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12 ${onboarding.showChecklist ? 'pb-20 sm:pb-0' : ''}`}>
      <Cell className="order-first md:col-span-2 xl:col-span-12" step={0}>
        <WelcomeBar />
      </Cell>
      <Cell className="order-first md:col-span-2 xl:col-span-12" step={0}>
        <VerseOfTheDay />
      </Cell>
      {onboarding.showChecklist && (
        <Cell className="order-first hidden sm:block md:col-span-2 xl:col-span-12" step={0}>
          <GettingStartedCard onPersonalise={onboarding.state.question === 'skipped' ? () => setAskAgain(true) : undefined} />
        </Cell>
      )}
      <Cell className="order-2 md:col-span-2 xl:col-span-12" step={1}>
        <TaskBox search={query} />
      </Cell>
      <Cell className="order-2 md:col-span-2 xl:col-span-12" step={1}>
        <DeadlineCalendar tasks={tasks} />
      </Cell>
      <Cell className="order-4 md:col-span-2 xl:col-span-12" step={2}>
        <RecentActivity search={query} />
      </Cell>
      <Cell className="order-3 md:col-span-2 xl:col-span-8" step={3}>
        <OverviewKpis />
      </Cell>
      <Cell className="order-8 md:col-span-2 xl:col-span-4" step={4}>
        <StockLevelsChart stock={stock} />
      </Cell>
      <Cell className="order-6 md:col-span-2 xl:col-span-12" step={5}>
        <ProjectsTable />
      </Cell>
    </div>
    <GettingStartedBar />
    </>
  );
}
