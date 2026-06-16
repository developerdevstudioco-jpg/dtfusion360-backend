import { FolderKanban, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { useMemo } from 'react';
import { User, Page } from '../../../../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card';
import { Badge } from '../../../../../components/ui/badge';
import { useAppSelector } from '../../../../../store/hooks';
import { WidgetVisibility } from '../types/dashboardTypes';
import KPICard from '../components/KPICard';
import ActionRequiredPanel from '../components/ActionRequiredPanel';
import APQPChart from '../components/APQPChart';
import QuickActions from '../components/QuickActions';
import RecentActivity from '../components/RecentActivity';
import SupportCard from '../components/SupportCard';

interface ExecutiveDashboardProps {
  user: User;
  onNavigate: (page: Page) => void;
  visibleWidgets: WidgetVisibility;
}

export default function ExecutiveDashboard({ user, onNavigate, visibleWidgets }: ExecutiveDashboardProps) {
  const dashboard = useAppSelector(state => state.dashboard);
  const stats = dashboard.stats;

  const overdueTasks = useMemo(
    () => dashboard.tasks.filter((task) => task.status.toLowerCase() === 'overdue').length,
    [dashboard.tasks]
  );

  const pendingTasks = useMemo(
    () => dashboard.tasks.filter((task) => task.status.toLowerCase() === 'pending').length,
    [dashboard.tasks]
  );

  const activeProjects = useMemo(
    () => dashboard.projects.filter((project) =>
      ['active', 'in progress', 'Active', 'In Progress'].includes(project.status)
    ).length,
    [dashboard.projects]
  );

  const kpiData = useMemo(() => [
    {
      title: 'Active Projects',
      value: stats?.activeProjects ?? activeProjects,
      icon: FolderKanban,
      change: `${activeProjects} currently active`,
      color: '#ed1c24'
    },
    {
      title: 'Completed Tasks',
      value: stats?.completedTasks ?? dashboard.tasks.filter((task) =>
        ['completed', 'Completed'].includes(task.status)
      ).length,
      icon: CheckCircle2,
      change: 'This period',
      color: '#2ecc71'
    },
    {
      title: 'At Risk / Delayed',
      value: overdueTasks,
      icon: AlertCircle,
      change: 'Need review',
      color: '#f5a623'
    },
    {
      title: 'Pending Tasks',
      value: pendingTasks,
      icon: Activity,
      change: `${pendingTasks} open items`,
      color: '#3498db'
    },
  ], [stats, activeProjects, overdueTasks, pendingTasks, dashboard.tasks]);

  const actionItems = useMemo(
    () => dashboard.tasks
      .filter((task) => ['overdue', 'pending'].includes(task.status.toLowerCase()))
      .slice(0, 3)
      .map((task) => ({
        id: task.id,
        title: task.task,
        type: 'Task',
        priority: task.priority || 'Medium',
        due: task.dueDate || 'No due date'
      })),
    [dashboard.tasks]
  );

  const apqpPhaseData = useMemo(
    () => stats?.projectsByPhase
      ? Object.entries(stats.projectsByPhase).map(([phase, projects]) => ({
          phase: phase.substring(0, 8),
          projects,
          name: phase
        }))
      : [],
    [stats]
  );

  const topRisks = useMemo(
    () => dashboard.tasks
      .filter((task) => ['overdue', 'delayed', 'blocked'].includes(task.status.toLowerCase()))
      .slice(0, 3)
      .map((task) => ({
        project: task.phase || 'Project Task',
        risk: task.task,
        impact: task.priority || 'High',
        status: task.status
      })),
    [dashboard.tasks]
  );

  return (
    <>
      {/* Action Required Panel */}
      {visibleWidgets.actionPanel && <ActionRequiredPanel items={actionItems} />}

      {/* KPI Cards */}
      {visibleWidgets.kpi && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiData.map((kpi, index) => (
            <KPICard key={index} kpi={kpi} />
          ))}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* APQP Chart */}
          {visibleWidgets.mainChart && <APQPChart data={apqpPhaseData} />}

          {/* Strategic Risks */}
          {visibleWidgets.roleSpecific && (
            <Card>
              <CardHeader>
                <CardTitle>Strategic Risks & Delays</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topRisks.length > 0 ? (
                    topRisks.map((risk, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{risk.project}</p>
                          <p className="text-sm text-muted-foreground">{risk.risk}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive">{risk.impact}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">{risk.status}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">No immediate strategic risks detected.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {visibleWidgets.recentActivity && <RecentActivity />}
          <QuickActions isSuperAdmin={false} isQA={false} onNavigate={onNavigate} />
          <SupportCard />
        </div>
      </div>
    </>
  );
}
