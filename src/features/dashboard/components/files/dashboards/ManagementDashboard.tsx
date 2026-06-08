import {
  FolderKanban, Clock, Users, AlertCircle, Check, X, CheckCircle, UserIcon, Plus,
  Info,
  Minus
} from 'lucide-react';
import { User, Page, Project } from '../../../../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card';
import { WidgetVisibility } from '../types/dashboardTypes';
import { ACTION_ITEMS, MANAGEMENT_TEAM_LOAD, APQP_PHASE_DATA } from '../constants/mockData';
import KPICard from '../components/KPICard';
import ActionRequiredPanel from '../components/ActionRequiredPanel';
import APQPChart from '../components/APQPChart';
import QuickActions from '../components/QuickActions';
import RecentActivity from '../components/RecentActivity';
import SupportCard from '../components/SupportCard';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../../../components/ui/dialog';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';
import { Textarea } from '../../../../../components/ui/textarea';
import { ScrollArea } from '../../../../../components/ui/scroll-area';
import { addFile, addFileRevision, removePendingUpload, PendingUpload, approvePendingUploadAsync, fetchPendingUploadsAsync } from '../../../../files/fileSlice';
import { approveProjectRequest, rejectProjectRequest } from '../../../../projects/projectSlice';
import { useAppSelector, useAppDispatch } from '../../../../../store/hooks';

interface ManagementDashboardProps {
  user: User;
  onNavigate: (page: Page) => void;
  visibleWidgets: WidgetVisibility;
}

export default function ManagementDashboard({ user, onNavigate, visibleWidgets }: ManagementDashboardProps) {
  const pendingUploads = useAppSelector(state => state.files.pendingUploads);
  const loading = useAppSelector(state => state.files.loading);
  const projects = useAppSelector(state => state.projects.projects);

  console.log("locading", loading) // Debug log to check loading state and pending uploads
  const dispatch = useAppDispatch();
  const [pendingToApprove, setPendingToApprove] = useState<PendingUpload | null>(null);

  // Project Approval State
  const [projectToApprove, setProjectToApprove] = useState<Project | null>(null);
  const [projectRejectionReason, setProjectRejectionReason] = useState('');
  const [isRejectingProject, setIsRejectingProject] = useState(false);

  // Fetch pending uploads when dashboard loads
  useEffect(() => {
    dispatch(fetchPendingUploadsAsync());
  }, [dispatch]);

  const handleApprovePendingUpload = async (pending: PendingUpload) => {
    try {
      await dispatch(approvePendingUploadAsync({
        pendingId: pending.id,
        type: pending.type,
        folderId: pending.folderId,
        subdomainId: pending.subdomainId,
        fileId: pending.fileId,
        file: pending.file,
        revision: pending.revision
      })).unwrap();
      toast.success(`${pending.file?.name || pending.revision?.fileName} approved and published.`);
    } catch (error) {
      toast.error('Failed to approve on backend');
    }
  };

  const handleApproveProject = async () => {
    if (!projectToApprove) return;
    try {
      await dispatch(approveProjectRequest({ id: projectToApprove.id })).unwrap();
      toast.success(`Project request approved successfully.`);
      setProjectToApprove(null);
    } catch (error: any) {
      toast.error(error || 'Failed to approve project request');
    }
  };

  const handleRejectProject = async () => {
    if (!projectToApprove) return;
    if (isRejectingProject && !projectRejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    if (!isRejectingProject) {
      setIsRejectingProject(true);
      return;
    }

    try {
      await dispatch(rejectProjectRequest({ id: projectToApprove.id, rejectionReason: projectRejectionReason })).unwrap();
      toast.success(`Project request rejected.`);
      setProjectToApprove(null);
      setProjectRejectionReason('');
      setIsRejectingProject(false);
    } catch (error: any) {
      toast.error(error || 'Failed to reject project request');
    }
  };

  const handleActionClick = (item: any) => {
    if (item.id.startsWith('pending-')) {
      const pendingId = item.id.replace('pending-', '');
      const pending = pendingUploads.find(p => p.id === pendingId);
      if (pending) {
        setPendingToApprove(pending);
      }
    } else if (item.id.startsWith('project-approval-')) {
      const projectId = item.id.replace('project-approval-', '');
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setProjectToApprove(project);
        setProjectRejectionReason('');
        setIsRejectingProject(false);
      }
    } else {
      onNavigate('files');
    }
  };

  const kpiData = [
    { title: 'Active Projects', value: '24', icon: FolderKanban, change: '+3 this month', color: '#ed1c24' },
    { title: 'Pending Approvals', value: pendingUploads.length > 0 ? pendingUploads.length.toString() : '12', icon: Clock, change: pendingUploads.length > 0 ? `${pendingUploads.length} files need review` : '4 high priority', color: '#f5a623' },
    { title: 'Team Workload', value: '92%', icon: Users, change: 'High utilization', color: '#3498db' },
    { title: 'Overdue Tasks', value: '8', icon: AlertCircle, change: 'Escalation needed', color: '#ed1c24' },
  ];

  const pendingProjectRequests = projects.filter(p => p.pendingApprovalRequest && p.pendingApprovalRequest.status === 'pending');

  const dynamicActionItems = [
    ...pendingProjectRequests.map(p => ({
      id: `project-approval-${p.id}`,
      title: `Approve ${p.pendingApprovalRequest?.type === 'delete' ? 'Deletion' : 'Update'}: ${p.name}`,
      type: 'Project Approval Needed',
      due: `Requested on ${new Date(p.pendingApprovalRequest?.requestedAt || '').toLocaleDateString()} by ${p.pendingApprovalRequest?.requestedByName}`,
      priority: 'high' as const
    })),
    ...pendingUploads.map(pu => ({
      id: `pending-${pu.id}`,
      title: `Approve: ${pu.file?.name || pu.revision?.fileName}`,
      type: 'File Approval Needed',
      due: `Uploaded on ${pu.uploadedDate} by ${pu.uploader}`,
      priority: 'high' as const
    }))
  ];

  const getWorkloadColor = (status: string) => {
    if (status === 'Overloaded') return 'bg-red-500';
    if (status === 'Optimal') return 'bg-green-500';
    return 'bg-blue-400';
  };

  return (
    <>
      {/* Action Required Panel */}
      {visibleWidgets.actionPanel && <ActionRequiredPanel items={dynamicActionItems} onActionClick={handleActionClick} loading={loading} />}

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
          {visibleWidgets.mainChart && <APQPChart data={APQP_PHASE_DATA} />}

          {/* Team Workload Distribution */}
          {visibleWidgets.roleSpecific && (
            <Card>
              <CardHeader>
                <CardTitle>Team Workload Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {MANAGEMENT_TEAM_LOAD.map((member, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{member.member}</span>
                        <span className="text-muted-foreground">{member.tasks} active tasks</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getWorkloadColor(member.status)}`}
                          style={{ width: `${Math.min(member.tasks * 8, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
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

      {/* Confirmation Dialog for File Approval */}
      <Dialog open={!!pendingToApprove} onOpenChange={(open: any) => !open && setPendingToApprove(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Approval</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve <strong>{pendingToApprove?.type === 'file' ? pendingToApprove?.file?.name : pendingToApprove?.revision?.fileName}</strong>? It will become visible to all permitted users.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPendingToApprove(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingToApprove) {
                  handleApprovePendingUpload(pendingToApprove);
                  setPendingToApprove(null);
                }
              }}
              style={{ backgroundColor: '#ed1c24' }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Approval Dialog */}
      <Dialog
        open={!!projectToApprove}
        onOpenChange={(open) => !open && setProjectToApprove(null)}
      >
        <DialogContent className="max-w-5xl w-[96vw] p-0 overflow-hidden bg-white border rounded-2xl shadow-xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="px-6 py-5 border-b bg-white flex items-center justify-between shrink-0">
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                {projectToApprove?.pendingApprovalRequest?.type === "delete"
                  ? "Review Deletion Request"
                  : "Review Update Request"}
              </DialogTitle>

              <p className="text-sm text-slate-500 mt-1">
                Requested by{" "}
                <span className="font-medium text-slate-700">
                  {projectToApprove?.pendingApprovalRequest?.requestedByName}
                </span>
              </p>
            </div>

            <Badge className="bg-amber-100 text-amber-700 border-0 rounded-full px-4 py-1">
              Pending Review
            </Badge>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 space-y-6">

            {/* Reason */}
            {projectToApprove?.pendingApprovalRequest?.reason && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">
                  Reason
                </p>

                <p className="text-sm text-slate-700 leading-relaxed">
                  {projectToApprove.pendingApprovalRequest.reason}
                </p>
              </div>
            )}

            {/* Changes Table */}
            {projectToApprove?.pendingApprovalRequest?.type === "edit" &&
              projectToApprove?.pendingApprovalRequest?.proposedChanges && (

                <div className="bg-white border rounded-2xl overflow-hidden">

                  <div className="px-5 py-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800">
                      Proposed Changes
                    </h3>

                    <span className="text-sm text-slate-500">
                      {
                        Object.keys(
                          projectToApprove.pendingApprovalRequest.proposedChanges
                        ).length
                      }{" "}
                      fields modified
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-slate-700 w-[20%]">
                            Field
                          </th>

                          <th className="text-left px-4 py-3 font-semibold text-red-600 w-[40%]">
                            Current Value
                          </th>

                          <th className="text-left px-4 py-3 font-semibold text-green-700 w-[40%]">
                            Proposed Value
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {Object.entries(
                          projectToApprove.pendingApprovalRequest.proposedChanges
                        ).map(([key, newValue]) => {

                          const oldValue =
                            projectToApprove[key as keyof Project];

                          if (String(oldValue) === String(newValue))
                            return null;

                          const displayKey = key
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (str) => str.toUpperCase())
                            .trim();

                          return (
                            <tr
                              key={key}
                              className="border-t hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-4 font-medium text-slate-700 align-top">
                                {displayKey}
                              </td>

                              <td className="px-4 py-4 align-top">
                                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-slate-500 break-words">
                                  {String(oldValue)?.trim() || (
                                    <span className="italic opacity-50">
                                      Empty
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-4 align-top">
                                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-slate-900 font-medium break-words">
                                  {String(newValue)?.trim() || (
                                    <span className="italic opacity-50 font-normal">
                                      Empty
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {/* Reject Box */}
            {isRejectingProject && (
              <div className="bg-white border border-red-200 rounded-2xl p-5">
                <label className="block text-sm font-semibold text-slate-800 mb-3">
                  Rejection Reason
                </label>

                <Textarea
                  placeholder="Provide reason for rejection..."
                  value={projectRejectionReason}
                  onChange={(e) =>
                    setProjectRejectionReason(e.target.value)
                  }
                  className="min-h-[120px] rounded-xl resize-none"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-white flex items-center justify-between shrink-0">

            <Button
              variant="ghost"
              onClick={() => {
                setProjectToApprove(null);
                setIsRejectingProject(false);
                setProjectRejectionReason("");
              }}
              className="rounded-full px-6"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-3">

              <Button
                variant="outline"
                onClick={handleRejectProject}
                className={`rounded-full px-6 ${isRejectingProject
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "text-red-600 border-red-200 hover:bg-red-50"
                  }`}
              >
                {isRejectingProject
                  ? "Confirm Rejection"
                  : "Reject"}
              </Button>

              {!isRejectingProject && (
                <Button
                  onClick={handleApproveProject}
                  className="bg-[#ed1c24] hover:bg-[#d91621] text-white rounded-full px-8"
                >
                  Approve Changes
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
