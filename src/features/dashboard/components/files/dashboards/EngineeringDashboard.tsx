import { CheckSquare, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
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

interface EngineeringDashboardProps {
  user: User;
  onNavigate: (page: Page) => void;
  visibleWidgets: WidgetVisibility;
}

export default function EngineeringDashboard({ user, onNavigate, visibleWidgets }: EngineeringDashboardProps) {
  const dashboard = useAppSelector(state => state.dashboard);

  const myTasks = useMemo(
    () => dashboard.tasks.filter((task) => task.assignedTo === user.employeeCode || task.assignedTo === user.name),
    [dashboard.tasks, user.employeeCode, user.name]
  );

  const overdueCount = useMemo(
    () => myTasks.filter((task) => task.status.toLowerCase() === 'overdue').length,
    [myTasks]
  );

  const pendingCount = useMemo(
    () => myTasks.filter((task) => task.status.toLowerCase() === 'pending').length,
    [myTasks]
  );

  const completedCount = useMemo(
    () => myTasks.filter((task) => task.status.toLowerCase() === 'completed').length,
    [myTasks]
  );

  const reworkCount = useMemo(
    () => myTasks.filter((task) => ['rework', 'review'].includes(task.status.toLowerCase())).length,
    [myTasks]
  );

  const kpiData = [
    { title: 'My Tasks', value: myTasks.length.toString(), icon: CheckSquare, change: `${overdueCount} due today`, color: '#3498db' },
    { title: 'Pending My Action', value: pendingCount.toString(), icon: Clock, change: pendingCount > 0 ? 'Blocking others' : 'No blockers', color: '#f5a623' },
    { title: 'Completed this week', value: completedCount.toString(), icon: CheckCircle2, change: 'On track', color: '#2ecc71' },
    { title: 'Rejected / Rework', value: reworkCount.toString(), icon: AlertCircle, change: 'Review feedback', color: '#ed1c24' },
  ];

  return (
    <>
      {/* Action Required Panel */}
      {visibleWidgets.actionPanel && (
        <ActionRequiredPanel
          items={myTasks.slice(0, 3).map((task) => ({
            id: task.id,
            title: task.task,
            type: 'Task',
            priority: task.priority || 'Medium',
            due: task.dueDate || 'No due date'
          }))}
        />
      )}

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
          {visibleWidgets.mainChart && <APQPChart data={dashboard.stats ? Object.entries(dashboard.stats.projectsByPhase).map(([phase, count]) => ({ phase: phase.substring(0, 8), projects: count, name: phase })) : []} />}

          {/* My Active Tasks */}
          {visibleWidgets.roleSpecific && (
            <Card>
              <CardHeader>
                <CardTitle>My Active Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {myTasks.length > 0 ? (
                    myTasks.map((task, i) => (
                      <div key={task.id || i} className="py-3 flex justify-between items-center">
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-1 w-2 h-2 rounded-full ${task.status.toLowerCase() === 'overdue' ? 'bg-red-500' : 'bg-blue-500'}`}
                          />
                          <div>
                            <p className="text-sm font-medium">{task.task}</p>
                            <p className="text-xs text-muted-foreground">Due: {task.dueDate || 'TBD'}</p>
                          </div>
                        </div>
                        <Badge variant="outline">{task.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-sm text-muted-foreground">No active tasks assigned.</div>
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
