import { useMemo } from 'react';
import { FlaskConical, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
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

interface QADashboardProps {
  user: User;
  onNavigate: (page: Page) => void;
  visibleWidgets: WidgetVisibility;
}

export default function QADashboard({ user, onNavigate, visibleWidgets }: QADashboardProps) {
  const dashboard = useAppSelector(state => state.dashboard);

  const overdueCalibration = useMemo(
    () => dashboard.calibrationItems.filter((item) => item.status.toLowerCase() === 'overdue'),
    [dashboard.calibrationItems]
  );

  const dueSoonCalibration = useMemo(
    () => dashboard.calibrationItems.filter((item) => item.status.toLowerCase() === 'due soon'),
    [dashboard.calibrationItems]
  );

  const pendingValidations = useMemo(
    () => dashboard.tasks.filter((task) => task.status.toLowerCase() === 'pending').length,
    [dashboard.tasks]
  );

  const complianceRate = useMemo(
    () => dashboard.calibrationItems.length > 0
      ? Math.round((dashboard.calibrationItems.filter((item) => item.status.toLowerCase() === 'completed').length / dashboard.calibrationItems.length) * 100)
      : 100,
    [dashboard.calibrationItems]
  );

  const kpiData = useMemo(() => [
    { title: 'Calibration Due', value: dueSoonCalibration.length.toString(), icon: FlaskConical, change: 'Next 7 days', color: '#f5a623' },
    { title: 'Overdue Instruments', value: overdueCalibration.length.toString(), icon: ShieldAlert, change: 'Action Required', color: '#ed1c24' },
    { title: 'Pending Validations', value: pendingValidations.toString(), icon: FileText, change: `${pendingValidations} open`, color: '#3498db' },
    { title: 'Compliance Rate', value: `${complianceRate}%`, icon: CheckCircle2, change: 'Measured by completed calibrations', color: '#2ecc71' },
  ], [overdueCalibration.length, dueSoonCalibration.length, pendingValidations, complianceRate]);

  const actionItems = useMemo(
    () => dashboard.tasks
      .filter((task) => ['pending', 'overdue'].includes(task.status.toLowerCase()))
      .slice(0, 3)
      .map((task) => ({
        id: task.id,
        title: task.task,
        type: 'Task Validation',
        priority: task.priority || 'Medium',
        due: task.dueDate || 'No due date'
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
          {visibleWidgets.mainChart && (
            <APQPChart data={dashboard.stats ? Object.entries(dashboard.stats.projectsByPhase).map(([phase, count]) => ({ phase: phase.substring(0, 8), projects: count, name: phase })) : []} />
          )}

          {/* Calibration & Compliance Status */}
          {visibleWidgets.roleSpecific && (
            <Card>
              <CardHeader>
                <CardTitle>Calibration & Compliance Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard.calibrationItems.length > 0 ? (
                    dashboard.calibrationItems.map((cal) => (
                      <div
                        key={cal.id}
                        className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <ShieldAlert className="w-5 h-5 text-red-600" />
                          <div>
                            <p className="text-sm font-medium text-red-900">
                              {cal.name} ({cal.id})
                            </p>
                            <p className="text-xs text-red-700">Due: {new Date(cal.dueDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Badge variant="destructive">{cal.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">No calibration alerts available.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {visibleWidgets.recentActivity && <RecentActivity />}
          <QuickActions isSuperAdmin={false} isQA={true} onNavigate={onNavigate} />
          <SupportCard />
        </div>
      </div>
    </>
  );
}
