import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, ChevronDown, Clock, FileText, FolderOpen, RotateCcw, User as UserIcon, Download } from 'lucide-react';
import { Page, Project, ProjectDR, ProjectFile, ProjectTask, User } from '../../types';
import Layout from '../Layout';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { toast } from 'sonner';
import APQPWorkflow from './APQPWorkflow';
import MessageHub from './MessageHub';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchUsers } from '../../features/users/userSlice';
import { fetchOrganizationData } from '../../features/organization/organizationSlice';
import { updateMoM, fetchMoMs, MoM, MoMActionItem } from '../../features/calendar/calendarSlice';
import { updateProject, updateProjectLocally } from '../../features/projects/projectSlice';
import { MOCK_PROJECT_LIFECYCLE } from '../../mocks/projectLifecycleMock';
import {
  buildPhasesFromTasks,
  createTaskUpdateEntry,
  deriveTaskStatusFromProgress,
  summarizeProjectWorkflow
} from '../../mocks/projectWorkflow';

interface ProjectDetailProps {
  user: User;
  projectId: string;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

interface GanttRow {
  id: string;
  name: string;
  phase: string;
  department: string;
  planDate: string;
  dueDate: string;
  status: string;
  progress: number;
  startDate: Date | null;
  endDate: Date | null;
}

const DAY_MS = 1000 * 60 * 60 * 24;

const parseScheduleDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatScheduleDate = (value?: string) => {
  const date = parseScheduleDate(value);
  if (!date) return '-';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const getGanttStatusColor = (status: string) => {
  if (status === 'Completed') return 'bg-emerald-500';
  if (status === 'In Progress') return 'bg-blue-500';
  if (status === 'Approved') return 'bg-teal-500';
  if (status === 'Rejected') return 'bg-red-500';
  return 'bg-slate-400';
};

const getGanttStatusBadge = (status: string) => {
  if (status === 'Completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'In Progress') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'Approved') return 'border-teal-200 bg-teal-50 text-teal-700';
  if (status === 'Rejected') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

export default function ProjectDetail({ user, projectId, onNavigate, onLogout }: ProjectDetailProps) {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState('apqp');
  const projects = useAppSelector(state => state.projects.projects);
  const allUsers = useAppSelector(state => state.users.users);
  const moms = useAppSelector(state => state.calendar.moms);
  const plants = useAppSelector(state => state.organization.plants);
  const departments = useAppSelector(state => state.organization.departments);
  const departmentsLoaded = useAppSelector(state => state.organization.departments.length > 0);
  const [projectState, setProjectState] = useState<Project>(MOCK_PROJECT_LIFECYCLE);
  const [projectMoMs, setProjectMoMs] = useState<MoM[]>([]);

  const selectedProject = useMemo(() => {
    return projects.find(project => project.id === projectId) || null;
  }, [projectId, projects]);

  useEffect(() => {
    if (allUsers.length === 0) {
      dispatch(fetchUsers(undefined));
    }
    if (plants.length === 0 && !departmentsLoaded) {
      dispatch(fetchOrganizationData());
    }
    if (moms.length === 0) {
      dispatch(fetchMoMs());
    }
  }, [allUsers.length, departmentsLoaded, dispatch, plants.length, moms.length]);

  useEffect(() => {
    const nextProject = selectedProject || MOCK_PROJECT_LIFECYCLE;
    const workflowTasks = selectedProject
      ? selectedProject.workflowTasks || []
      : MOCK_PROJECT_LIFECYCLE.workflowTasks || [];
    const summary = summarizeProjectWorkflow(workflowTasks);

    setProjectState({
      ...nextProject,
      workflowTasks,
      progress: summary.progress,
      phase: summary.phase,
      status: selectedProject
        ? nextProject.status || summary.status
        : nextProject.status ?? summary.status,
    });
  }, [selectedProject]);

  const projectMomsFromStore = useMemo(() => {
    if (!selectedProject) return [];
    return moms.filter((mom) => mom.projectLink === selectedProject.id);
  }, [moms, selectedProject?.id]);

  useEffect(() => {
    setProjectMoMs(projectMomsFromStore);
  }, [projectMomsFromStore]);

  const showMomTab = projectMomsFromStore.length > 0;

  useEffect(() => {
    if (activeTab === 'mom' && !showMomTab) {
      setActiveTab('apqp');
    }
  }, [activeTab, showMomTab]);

  const phases = useMemo(() => buildPhasesFromTasks(projectState.workflowTasks || []), [projectState.workflowTasks]);
  const [selectedGanttPhaseId, setSelectedGanttPhaseId] = useState('all');
  const ganttTasks = useMemo(() => {
    if (selectedGanttPhaseId === 'all') {
      return projectState.workflowTasks || [];
    }

    const selectedPhase = phases.find((phase) => phase.id === selectedGanttPhaseId);
    return selectedPhase ? selectedPhase.tasks : projectState.workflowTasks || [];
  }, [phases, projectState.workflowTasks, selectedGanttPhaseId]);

  const ganttRows = useMemo<GanttRow[]>(() => {
    return ganttTasks
      .map((task) => {
        const planDate = parseScheduleDate(task.planDate);
        const dueDate = parseScheduleDate(task.dueDate || task.planDate);
        const startDate = planDate || dueDate;
        const endDate = dueDate || planDate;

        return {
          id: task.id,
          name: task.name,
          phase: task.phase,
          department: task.department,
          planDate: task.planDate || '',
          dueDate: task.dueDate || task.planDate || '',
          status: task.status,
          progress: task.progress || 0,
          startDate,
          endDate,
        };
      })
      .sort((left, right) => {
        const leftTime = left.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightTime = right.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime || left.name.localeCompare(right.name);
      });
  }, [ganttTasks]);

  const ganttTimeline = useMemo(() => {
    const datedRows = ganttRows.filter((row) => row.startDate && row.endDate);
    const projectStart = parseScheduleDate(projectState.startDate);
    const projectEnd = parseScheduleDate(projectState.endDate);
    const dateValues = [
      ...datedRows.flatMap((row) => [row.startDate as Date, row.endDate as Date]),
      ...(projectStart ? [projectStart] : []),
      ...(projectEnd ? [projectEnd] : []),
    ];

    if (dateValues.length === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { startDate: today, endDate: today, totalDays: 1, ticks: [today] };
    }

    const startDate = new Date(Math.min(...dateValues.map((date) => date.getTime())));
    const endDate = new Date(Math.max(...dateValues.map((date) => date.getTime())));
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1);
    const tickCount = Math.min(6, totalDays);
    const ticks = Array.from({ length: tickCount }, (_, index) => {
      const offset = tickCount === 1 ? 0 : Math.round((index * (totalDays - 1)) / (tickCount - 1));
      return new Date(startDate.getTime() + offset * DAY_MS);
    });

    return { startDate, endDate, totalDays, ticks };
  }, [ganttRows, projectState.endDate, projectState.startDate]);

  const todayOffsetPercent = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today < ganttTimeline.startDate || today > ganttTimeline.endDate) return null;
    return Math.min(100, Math.max(0, ((today.getTime() - ganttTimeline.startDate.getTime()) / DAY_MS / Math.max(1, ganttTimeline.totalDays - 1)) * 100));
  }, [ganttTimeline]);

  const getGanttBarStyle = (row: GanttRow) => {
    if (!row.startDate || !row.endDate) {
      return null;
    }

    const startOffsetDays = Math.max(0, Math.round((row.startDate.getTime() - ganttTimeline.startDate.getTime()) / DAY_MS));
    const durationDays = Math.max(1, Math.round((row.endDate.getTime() - row.startDate.getTime()) / DAY_MS) + 1);
    const left = (startOffsetDays / Math.max(1, ganttTimeline.totalDays)) * 100;
    const width = Math.max(2, (durationDays / Math.max(1, ganttTimeline.totalDays)) * 100);

    return {
      left: `${Math.min(98, left)}%`,
      width: `${Math.min(100 - left, width)}%`,
    };
  };

  const availableUsers = useMemo(() => {
    if (!projectState.plantId) {
      return allUsers.filter(candidate => candidate.status === 'Active');
    }
    return allUsers.filter(candidate => candidate.status === 'Active' && candidate.plantIds.includes(projectState.plantId!));
  }, [allUsers, projectState.plantId]);

  const projectMoMUserOptions = useMemo(() => {
    return allUsers
      .filter((user) => user.status === 'Active')
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        department: profile.role || profile.employeeCode,
      }));
  }, [allUsers]);

  const selectedPlantId = (() => { try { return localStorage.getItem('selectedPlantId'); } catch (e) { return null; } })();

  const getPlantIdForDept = (deptIdentifier?: string | undefined) => {
    if (!deptIdentifier) return undefined;
    const found = departments.find(d => d.id === deptIdentifier || d.name === deptIdentifier || d.code === deptIdentifier);
    return found?.plantId;
  };

  const handleProjectMoMChange = (momId: string, field: keyof MoM, value: string) => {
    setProjectMoMs((current) =>
      current.map((mom) =>
        mom.id === momId ? { ...mom, [field]: value } : mom
      )
    );
  };

  const handleProjectMoMActionItemChange = (
    momId: string,
    index: number,
    field: keyof MoMActionItem,
    value: string
  ) => {
    setProjectMoMs((current) =>
      current.map((mom) => {
        if (mom.id !== momId) return mom;
        const actionItems = mom.actionItems?.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: value } : item
        );
        return { ...mom, actionItems };
      })
    );
  };

  const saveProjectMoM = async (momToSave: MoM) => {
    try {
      const { id, employeeCode, ...updatedPayload } = momToSave;
      const updatedMom = await dispatch(updateMoM({ id: momToSave.id, momData: updatedPayload })).unwrap();
      toast.success('MoM updated successfully');
      setProjectMoMs((current) => current.map((mom) => (mom.id === updatedMom.id ? updatedMom : mom)));
    } catch {
      toast.error('Failed to update MoM');
    }
  };

  const teamMembers = useMemo(() => {
    const uniqueOwners = new Map<string, { name: string; role: string; dept: string }>();

    (projectState.workflowTasks || []).forEach((task) => {
      if (!task.assignedTo) return;
      const profile = availableUsers.find(candidate => candidate.id === task.assigneeId || candidate.name === task.assignedTo);
      uniqueOwners.set(task.assignedTo, {
        name: task.assignedTo,
        role: profile?.role || 'Team Member',
        dept: task.department,
      });
    });

    return Array.from(uniqueOwners.values());
  }, [availableUsers, projectState.workflowTasks]);

  const cftTeamMembers = useMemo(() => {
    const ids = projectState.cftMemberIds || [];
    const matchedNames = ids
      .map((id) => availableUsers.find((user) => user.id === id)?.name || id)
      .filter(Boolean);

    if (matchedNames.length > 0) return matchedNames;
    return projectState.cftMembers || [];
  }, [availableUsers, projectState.cftMemberIds, projectState.cftMembers]);

  const recentActivity = useMemo(() => {
    return (projectState.workflowTasks || [])
      .flatMap((task) => {
        // enforce selected plant: if set, only include tasks that belong to that plant
        if (selectedPlantId) {
          const taskPlant = getPlantIdForDept(task.department || task.departmentId);
          if (taskPlant !== selectedPlantId) return [];
        }
        return task.updates.map((update) => ({
          id: update.id,
          text: `${update.updatedBy} updated ${task.name} to ${update.progress}%`,
          time: update.date,
        }));
      })
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
      .slice(0, 5);
  }, [projectState.workflowTasks]);

  const repositoryFiles = useMemo(() => {
    const all = [...(projectState.projectFiles || [])];
    const filtered = selectedPlantId
      ? all.filter((f) => getPlantIdForDept(f.department) === selectedPlantId)
      : all;
    return filtered.sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime());
  }, [projectState.projectFiles]);

  const syncProjectState = async (tasks: ProjectTask[], extraChanges?: Partial<Project>) => {
    const summary = summarizeProjectWorkflow(tasks);
    const previousStatus = projectState.status;
    const nextStatus = summary.allTasksCompleted
      ? 'Completed'
      : (projectState.status === 'On Hold' || projectState.status === 'Cancelled')
        ? projectState.status
        : summary.status;

    const nextProject: Project = {
      ...projectState,
      ...extraChanges,
      workflowTasks: tasks,
      progress: summary.progress,
      phase: summary.phase,
      status: extraChanges?.status || nextStatus,
    };

    setProjectState(nextProject);

    if (selectedProject) {
      const changes = {
        ...extraChanges,
        workflowTasks: tasks,
        progress: summary.progress,
        phase: summary.phase,
        status: extraChanges?.status || nextStatus,
      };
      // Optimistic local update
      dispatch(updateProjectLocally({ id: selectedProject.id, changes }));
      // Persist to backend
      try {
        await dispatch(updateProject({ ...nextProject, id: selectedProject.id })).unwrap();
      } catch {
        toast.error('Failed to sync project update to server.');
      }
    }

    if (summary.allTasksCompleted && previousStatus !== 'Completed') {
      toast.success('All workflow tasks are complete. Project moved to Completed automatically.');
    }
  };

  const handleReassignTask = (phaseId: string, taskId: string, assigneeIds: string[], dueDate: string) => {
    const assignees = availableUsers.filter(candidate => assigneeIds.includes(candidate.id));
    if (assignees.length === 0) return;

    const assigneeNames = assignees.map(a => a.name).join(', ');
    const assigneeIdsJoined = assignees.map(a => a.id).join(',');

    const updatedTasks = (projectState.workflowTasks || []).map((task) => {
      if (task.id !== taskId) return task;

      const status = task.progress === 100 ? 'Completed' : task.progress > 0 ? 'In Progress' : 'Pending';

      return {
        ...task,
        assigneeId: assigneeIdsJoined,
        assignedTo: assigneeNames,
        assignedBy: user.name,
        dueDate,
        lastUpdated: new Date().toISOString(),
        updatedBy: user.name,
        updates: [
          ...task.updates,
          createTaskUpdateEntry({
            updatedBy: user.name,
            updatedById: user.id,
            description: `Task assigned to ${assigneeNames}. Due date set to ${dueDate}.`,
            progress: task.progress,
            status,
            attachments: [],
            date: new Date().toISOString(),
          }),
        ],
      };
    });

    syncProjectState(updatedTasks);
    toast.success(`${assigneeNames} assigned as the task owner(s).`);
  };

  const handleAddTaskUpdate = (phaseId: string, taskId: string, update: { description: string; progress: number; files: File[] }) => {
    const timestamp = new Date().toISOString();
    const uploadedFiles: ProjectFile[] = [];

    const updatedTasks = (projectState.workflowTasks || []).map((task) => {
      if (task.id !== taskId) return task;

      const nextStatus = deriveTaskStatusFromProgress(update.progress);
      const attachmentNames = update.files.map((file) => file.name);

      uploadedFiles.push(
        ...update.files.map((file, index) => ({
          id: `${task.id}-${Date.now()}-${index}`,
          name: file.name,
          url: URL.createObjectURL(file),
          taskId: task.id,
          taskName: task.name,
          phase: task.phase,
          department: task.department,
          uploadedBy: user.name,
          uploadedAt: timestamp,
        }))
      );

      // Add the user's update to the task updates but DO NOT apply progress/status to the task
      // until a manager reviews and accepts the update.
      return {
        ...task,
        // preserve existing progress/status; only record the update as pending review
        lastUpdated: timestamp,
        updatedBy: user.name,
        updates: [
          ...task.updates,
          createTaskUpdateEntry({
            updatedBy: user.name,
            updatedById: user.id,
            description: update.description,
            progress: update.progress,
            status: nextStatus,
            attachments: attachmentNames,
            date: timestamp,
            reviewStatus: 'pending',
          }),
        ],
      };
    });

    syncProjectState(updatedTasks, {
      projectFiles: [...(projectState.projectFiles || []), ...uploadedFiles],
    });
    toast.success('Task update saved successfully.');
  };

  const handleReviewTaskUpdate = (phaseId: string, taskId: string, updateId: string, action: 'accepted' | 'hold' | 'not-acceptable', note?: string) => {
    const timestamp = new Date().toISOString();

    const updatedTasks = (projectState.workflowTasks || []).map((task) => {
      if (task.id !== taskId) return task;

      let appliedProgress = task.progress;
      let appliedStatus = task.status;

      const updates = task.updates.map((u) => {
        if (u.id !== updateId) return u;
        // mark the update with review metadata
        const reviewed = {
          ...u,
          reviewStatus: action,
          reviewedBy: user.name,
          reviewedById: user.id,
          reviewedAt: timestamp,
          reviewNote: note || undefined,
        } as typeof u;

        // if manager accepted, apply the progress/status to the parent task
        if (action === 'accepted') {
          appliedProgress = u.progress;
          appliedStatus = deriveTaskStatusFromProgress(u.progress);
        }

        return reviewed;
      });

      // Also append a manager action entry to history for clarity
      const managerNote = note || `${user.name} marked update as ${action}`;
      const appended = createTaskUpdateEntry({
        updatedBy: user.name,
        updatedById: user.id,
        description: managerNote,
        progress: appliedProgress,
        status: appliedStatus,
        attachments: [],
        date: timestamp,
        reviewStatus: action,
      });

      return {
        ...task,
        // if accepted, update task-level progress/status/actualDate
        progress: appliedProgress,
        status: appliedStatus,
        actualDate: appliedProgress === 100 ? timestamp.slice(0, 10) : task.actualDate,
        updates: [
          ...updates,
          appended,
        ],
      };
    });

    syncProjectState(updatedTasks);
    toast.success('Review recorded');
  };

  const handleOpenUpdateAttachment = (phaseId: string, taskId: string, attachmentName: string) => {
    const found = (projectState.projectFiles || []).find((f) => f.taskId === taskId && f.name === attachmentName);
    if (found && found.url) {
      window.open(found.url, '_blank', 'noopener,noreferrer');
      return;
    }
    toast.error('Attachment not available');
  };

  const openProjectFile = (file: ProjectFile) => {
    window.open(file.url, '_blank', 'noopener,noreferrer');
  };

  const downloadProjectFile = (file: ProjectFile) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openDrAttachment = (dr: ProjectDR) => {
    if (!dr.fileUrl) return;
    window.open(dr.fileUrl, '_blank', 'noopener,noreferrer');
  };

  const downloadDrAttachment = (dr: ProjectDR) => {
    if (!dr.fileUrl) return;
    const link = document.createElement('a');
    link.href = dr.fileUrl;
    link.download = dr.fileName || dr.number || 'dr-attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProjectStatusChange = async (status: string) => {
    setProjectState(current => ({ ...current, status }));
    if (selectedProject) {
      dispatch(updateProjectLocally({ id: selectedProject.id, changes: { status } }));
      try {
        await dispatch(updateProject({ ...projectState, id: selectedProject.id, status })).unwrap();
      } catch {
        toast.error('Failed to sync status change to server.');
      }
    }
  };

  const getInitials = (name: string) => name.split(' ').map(part => part[0]).join('').substring(0, 2);

  return (
    <Layout user={user} currentPage="projects" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => onNavigate('projects')}
              className="pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Last updated {projectState.workflowTasks?.some(task => task.lastUpdated)
                  ? new Date(
                    [...(projectState.workflowTasks || [])]
                      .map(task => task.lastUpdated)
                      .filter(Boolean)
                      .sort()
                      .slice(-1)[0] as string
                  ).toLocaleDateString()
                  : 'Not available'}
              </span>

              {(user.role === 'Manager' || user.role === 'Admin' || user.role === 'SuperAdmin') && (
                <Button variant="outline" className="ml-4 border-dashed border-slate-300">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Revise Target Dates
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className={
                    projectState.status === 'In Progress' ? "bg-[#f5a623] hover:bg-[#d48e1b]" :
                      projectState.status === 'Completed' ? "bg-[#2ecc71] hover:bg-[#27ae60]" :
                        projectState.status === 'On Hold' ? "bg-slate-700 hover:bg-slate-800" :
                          "bg-[#ed1c24]"
                  }>
                    {projectState.status}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {['Active', 'In Progress', 'On Hold', 'Completed', 'Cancelled'].map((status) => (
                    <DropdownMenuItem key={status} onClick={() => handleProjectStatusChange(status)}>
                      {status}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Card className="border-none shadow-md bg-white rounded-lg overflow-hidden">
            <div className="flex flex-col lg:flex-row">
              {/* Left Section */}
              <div className="px-6 py-6 lg:w-1/3 bg-white border-r border-slate-200">
                {/* Header */}
                <div className="flex items-start gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-[#ed1c24] font-bold text-lg shrink-0">
                    {getInitials(projectState.name)}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">{projectState.name}</h1>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
                        {projectState.partCode}
                      </span>
                      <span className="text-xs text-slate-600">{projectState.customer}</span>
                    </div>
                  </div>
                </div>

                {/* Info Items */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon className="w-4 h-4 text-[#ed1c24]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Project Lead</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{projectState.projectLead}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="w-4 h-4 text-[#ed1c24]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">SOP Date</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{projectState.sopDate}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-[#ed1c24]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">APQP Reference</p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{projectState.apqpNo || 'Pending'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Section */}
              <div className="px-6 py-6 lg:w-2/3 bg-white">
                {/* Top Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Vehicle / Model</p>
                    <p className="text-sm font-medium text-slate-900">{projectState.vehicleModel || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">RFQ No.</p>
                    <p className="text-sm font-medium text-slate-900">{projectState.rfqNo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Plant</p>
                    <p className="text-sm font-medium text-slate-900">{projectState.plant || plants.find(plant => plant.id === projectState.plantId)?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Start Date</p>
                    <p className="text-sm font-medium text-slate-900">{projectState.startDate || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">End Date</p>
                    <p className="text-sm font-medium text-slate-900">{projectState.endDate || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">SOP Volume</p>
                    <p className="text-sm font-medium text-slate-900">{projectState.sopVolume || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Department</p>
                    <p className="text-sm font-medium text-slate-900">{departments.find(d => d.id === projectState.departmentId)?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">CFT Members</p>
                    <p className="text-sm font-medium text-slate-900">{projectState.cftMemberIds?.length || 0} Members</p>
                  </div>
                </div>

                {/* Progress Box */}
                <div className="bg-gradient-to-br from-white via-white to-slate-50/30 border border-slate-200 rounded-xl p-6 shadow-sm mt-4">
                  <div className="flex items-end justify-between gap-8">
                    {/* Phase Section */}
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-3">Current Active Phase</p>
                      <div className="inline-flex items-baseline gap-2">
                        <p className="text-3xl font-bold bg-gradient-to-r from-[#ed1c24] to-[#d91621] bg-clip-text text-transparent">{projectState.phase || 'Phase 1'}</p>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="hidden sm:block w-px h-16 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200/0" />

                    {/* Progress Section */}
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-2 mb-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Overall Progress</p>
                        <span className="text-2xl font-bold text-[#ed1c24]">{projectState.progress || 0}<span className="text-lg text-slate-400">%</span></span>
                      </div>

                      {/* Enhanced Progress Bar */}
                      {/* Enhanced Progress Bar */}
                      <div className="relative mb-3">
                        <Progress
                          value={projectState.progress || 0}
                          // Using [&>div] targets the internal "indicator" div inside the Progress component
                          className="h-2.5 bg-slate-200 rounded-full overflow-hidden [&>div]:bg-gradient-to-r [&>div]:from-[#ed1c24] [&>div]:to-[#f44545] [&>div]:transition-all [&>div]:duration-500"
                        />
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/20 to-transparent pointer-events-none" />
                      </div>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        {projectState.status === 'Completed' ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Workflow complete
                          </span>
                        ) : (projectState.progress || 0) > 0 ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Workflow in progress
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Pending task initiation
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex w-full overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-slate-100/80 p-1.5 rounded-xl inline-flex shadow-inner border border-slate-200/60 backdrop-blur-sm">
              <TabsList className="bg-transparent h-auto p-0 gap-1 flex">
                <TabsTrigger
                  value="apqp"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#ed1c24] data-[state=active]:shadow-sm px-6 py-2.5 font-medium text-slate-600 hover:text-slate-900 transition-all whitespace-nowrap"
                >
                  APQP Execution
                </TabsTrigger>
                <TabsTrigger
                  value="info"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#ed1c24] data-[state=active]:shadow-sm px-6 py-2.5 font-medium text-slate-600 hover:text-slate-900 transition-all whitespace-nowrap"
                >
                  Project Info
                </TabsTrigger>
                <TabsTrigger
                  value="files"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#ed1c24] data-[state=active]:shadow-sm px-6 py-2.5 font-medium text-slate-600 hover:text-slate-900 transition-all whitespace-nowrap"
                >
                  File Repository
                </TabsTrigger>
                <TabsTrigger
                  value="gantt"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#ed1c24] data-[state=active]:shadow-sm px-6 py-2.5 font-medium text-slate-600 hover:text-slate-900 transition-all whitespace-nowrap"
                >
                  Gantt Chart
                </TabsTrigger>
                <TabsTrigger
                  value="messages"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#ed1c24] data-[state=active]:shadow-sm px-6 py-2.5 font-medium text-slate-600 hover:text-slate-900 transition-all whitespace-nowrap"
                >
                  Team Chat
                </TabsTrigger>
                {showMomTab && (
                  <TabsTrigger
                    value="mom"
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#ed1c24] data-[state=active]:shadow-sm px-6 py-2.5 font-medium text-slate-600 hover:text-slate-900 transition-all whitespace-nowrap"
                  >
                    Project MoMs
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
          </div>

          <TabsContent value="apqp" className="outline-none">
            <div className="grid grid-cols-1 gap-8">
              <div>
                <APQPWorkflow
                  phases={phases}
                  user={user}
                  availableUsers={availableUsers}
                  onReassignTask={handleReassignTask}
                  onAddTaskUpdate={handleAddTaskUpdate}
                  onReviewTaskUpdate={handleReviewTaskUpdate}
                  onOpenUpdateAttachment={handleOpenUpdateAttachment}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="info" className="outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Project Info</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">Key project details, schedule, and team alignment.</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-slate-700">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</p>
                        <p className="mt-1 font-medium">{projectState.customer || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vehicle / Model</p>
                        <p className="mt-1 font-medium">{projectState.vehicleModel || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">RFQ No.</p>
                        <p className="mt-1 font-medium">{projectState.rfqNo || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Part Code</p>
                        <p className="mt-1 font-medium">{projectState.partCode || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SOP Date</p>
                        <p className="mt-1 font-medium">{projectState.sopDate || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Lead</p>
                        <p className="mt-1 font-medium">{projectState.projectLead || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</p>
                        <p className="mt-1 font-medium">{projectState.startDate || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</p>
                        <p className="mt-1 font-medium">{projectState.endDate || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                        <p className="mt-1 font-medium">{projectState.status || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</p>
                        <p className="mt-1 font-medium">{projectState.progress ?? 0}%</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CFT Members</p>
                        {cftTeamMembers.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {cftTeamMembers.map((member, index) => (
                              <span key={`${member}-${index}`} className="rounded-full border border-slate-200 bg-slate-100 py-1 px-3 text-xs font-medium text-slate-700">
                                {member}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">No CFT team members assigned.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">DR Attachments</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">View and download design review attachments submitted with the project.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(projectState.drs || []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                        No DR attachments are available for this project.
                      </div>
                    ) : (
                      (projectState.drs || []).map((dr) => (
                        <div key={dr.id} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{dr.fileName || dr.number || 'DR Attachment'}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {dr.fileType ? `${dr.fileType.toUpperCase()} · ` : ''}
                              {dr.fileSize ? `${Math.round(dr.fileSize / 1024)} KB · ` : ''}
                              {dr.uploadedAt ? new Date(dr.uploadedAt).toLocaleDateString() : 'Uploaded date unavailable'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDrAttachment(dr)}
                              disabled={!dr.fileUrl}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => downloadDrAttachment(dr)}
                              disabled={!dr.fileUrl}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Team Members</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {teamMembers.length > 0 ? teamMembers.map((member, index) => (
                      <div key={`${member.name}-${index}`} className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-slate-100 text-slate-700 text-xs">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-none">{member.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{member.role} • {member.dept}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-slate-500">No task owners assigned yet.</p>
                    )}
                    <Separator />
                    <div className="text-xs text-slate-500">
                      Managers can delegate within their department and can also post task updates alongside assignees.
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActivity.length > 0 ? recentActivity.map((activity) => (
                        <div key={activity.id} className="flex gap-3 text-sm">
                          <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                          <div>
                            <p className="text-slate-700 leading-snug">{activity.text}</p>
                            <span className="text-xs text-muted-foreground">{new Date(activity.time).toLocaleString()}</span>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-slate-500">No updates have been posted yet.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gantt" className="outline-none">
            <Card>
              <CardHeader className="border-b">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-lg">Project Gantt Timeline</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      Task schedule view based on task name, plan date, and due date.
                    </p>
                  </div>
                  <Select value={selectedGanttPhaseId} onValueChange={setSelectedGanttPhaseId}>
                    <SelectTrigger className="w-full lg:w-64">
                      <SelectValue placeholder="All Phases" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Phases</SelectItem>
                      {phases.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id}>{phase.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {ganttRows.length > 0 ? (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span className="font-semibold text-slate-700">Range</span>
                      <span>{formatScheduleDate(ganttTimeline.startDate.toISOString())} to {formatScheduleDate(ganttTimeline.endDate.toISOString())}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{ganttRows.length} task{ganttRows.length === 1 ? '' : 's'}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                        Pending
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        In Progress
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Completed
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <div className="min-w-[1040px]">
                        <div className="grid grid-cols-[300px_140px_140px_minmax(420px,1fr)] border-b bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <div className="border-r px-4 py-3">Task Name</div>
                          <div className="border-r px-4 py-3">Plan Date</div>
                          <div className="border-r px-4 py-3">Due Date</div>
                          <div className="relative px-4 py-3">
                            <div className="flex items-center justify-between">
                              {ganttTimeline.ticks.map((tick) => (
                                <span key={tick.toISOString()}>
                                  {tick.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {ganttRows.map((row) => {
                            const barStyle = getGanttBarStyle(row);
                            const isOverdue = row.status !== 'Completed' && row.endDate && row.endDate < parseScheduleDate(new Date().toISOString())!;

                            return (
                              <div key={row.id} className="grid min-h-[72px] grid-cols-[300px_140px_140px_minmax(420px,1fr)] hover:bg-slate-50/80">
                                <div className="flex min-w-0 flex-col justify-center border-r px-4 py-3">
                                  <div className="truncate font-medium text-slate-900" title={row.name}>{row.name}</div>
                                  <div className="mt-1 flex items-center gap-2">
                                    <Badge variant="outline" className="max-w-[130px] truncate border-slate-200 bg-white text-[10px] text-slate-600">
                                      {row.phase}
                                    </Badge>
                                    <span className="truncate text-xs text-slate-500">{row.department}</span>
                                  </div>
                                </div>

                                <div className="flex items-center border-r px-4 py-3 text-sm font-medium text-slate-700">
                                  {formatScheduleDate(row.planDate)}
                                </div>

                                <div className="flex flex-col justify-center border-r px-4 py-3">
                                  <span className={isOverdue ? 'text-sm font-semibold text-red-600' : 'text-sm font-medium text-slate-700'}>
                                    {formatScheduleDate(row.dueDate)}
                                  </span>
                                  {isOverdue && <span className="mt-1 text-[11px] text-red-500">Overdue</span>}
                                </div>

                                <div className="relative px-4 py-3">
                                  <div className="absolute inset-x-4 top-0 bottom-0 grid grid-cols-6">
                                    {Array.from({ length: 6 }).map((_, index) => (
                                      <div key={index} className="border-l border-slate-100 first:border-l-0" />
                                    ))}
                                  </div>
                                  {todayOffsetPercent != null && (
                                    <div
                                      className="absolute bottom-2 top-2 w-px bg-red-400"
                                      style={{ left: `${todayOffsetPercent}%` }}
                                      aria-label="Today"
                                    />
                                  )}
                                  <div className="relative flex h-full min-h-[46px] items-center">
                                    {barStyle ? (
                                      <div
                                        className={`absolute h-7 rounded-md shadow-sm ${getGanttStatusColor(row.status)}`}
                                        style={barStyle}
                                        title={`${row.name}: ${formatScheduleDate(row.planDate)} to ${formatScheduleDate(row.dueDate)}`}
                                      >
                                        <div
                                          className="h-full rounded-md bg-white/25"
                                          style={{ width: `${Math.min(100, Math.max(0, row.progress))}%` }}
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-sm text-slate-400">No plan or due date</span>
                                    )}
                                    <Badge variant="outline" className={`absolute right-0 text-[10px] ${getGanttStatusBadge(row.status)}`}>
                                      {row.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-sm text-slate-500">
                    No Gantt timeline data is available for this project yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="outline-none">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-lg">Project File Repository</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {repositoryFiles.length > 0 ? (
                  <div className="space-y-3">
                    {repositoryFiles.map((file) => (
                      <div key={file.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-xl border bg-slate-50 p-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center text-slate-500">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="font-medium text-slate-900 truncate text-left hover:text-[#ed1c24]"
                              onClick={() => openProjectFile(file)}
                            >
                              {file.name}
                            </button>
                            <p className="text-sm text-slate-500">Task: {file.taskName}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Phase</p>
                            <p className="font-medium text-slate-700">{file.phase}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Department</p>
                            <p className="font-medium text-slate-700">{file.department}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Uploaded By</p>
                            <p className="font-medium text-slate-700">{file.uploadedBy}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Uploaded On</p>
                            <p className="font-medium text-slate-700">{new Date(file.uploadedAt).toLocaleString()}</p>
                          </div>
                          <div className="col-span-2 md:col-span-1 flex items-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => downloadProjectFile(file)}
                            >
                              Download
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <FolderOpen className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Files Uploaded Yet</h3>
                    <p className="text-slate-500 max-w-md">
                      Files uploaded through task updates will appear here automatically for this project.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="outline-none">
            <div className="bg-white rounded-xl border shadow-sm h-[600px]">
              <MessageHub user={user} onNavigate={onNavigate} onLogout={onLogout} embedded />
            </div>
          </TabsContent>

          {showMomTab && (
            <TabsContent value="mom" className="outline-none">
              <div className="space-y-6">
                {projectMoMs.map((mom) => (
                  <Card key={mom.id} className="border-none shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <CardTitle className="text-lg">{mom.meetingName}</CardTitle>
                          <p className="text-sm text-slate-500">{mom.date} · Status: {mom.status}</p>
                        </div>
                        <Button onClick={() => saveProjectMoM(mom)}>Save MoM</Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Meeting Type</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{mom.meetingType}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Venue</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{mom.venue || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Agenda</p>
                          <p className="mt-1 text-sm text-slate-700">{mom.agenda || 'No agenda provided'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Project Link</p>
                          <p className="mt-1 text-sm text-slate-900">{mom.projectLink || 'Not linked'}</p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Internal Attendees</p>
                          <p className="mt-1 text-sm text-slate-700">{mom.dtplUsers.join(', ') || 'None'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Discussion Points</p>
                          <p className="mt-1 text-sm text-slate-700">{mom.discussionPoints || 'None'}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-3">Action Items</p>
                        {mom.actionItems && mom.actionItems.length > 0 ? (
                          <div className="space-y-4">
                            {mom.actionItems.map((item, index) => (
                              <div key={`${mom.id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Discussion</p>
                                    <p className="mt-1 text-sm text-slate-700">{item.discussionPoint || 'No discussion point'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Action</p>
                                    <p className="mt-1 text-sm text-slate-700">{item.action || 'No action set'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Owner</p>
                                    <Select
                                      value={item.responsibilityName || ''}
                                      disabled={Boolean(item.targetDate)}
                                      onValueChange={(value) => {
                                        if (item.targetDate) return;
                                        handleProjectMoMActionItemChange(mom.id, index, 'responsibilityName', value);
                                      }}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select owner" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {projectMoMUserOptions.map((option) => (
                                          <SelectItem key={option.id} value={option.name}>
                                            {option.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                                    <Select
                                      value={item.status || 'Open'}
                                      onValueChange={(value) => handleProjectMoMActionItemChange(mom.id, index, 'status', value)}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {['Open', 'In Progress', 'Completed', 'Blocked'].map((statusOption) => (
                                          <SelectItem key={statusOption} value={statusOption}>
                                            {statusOption}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Target Date</p>
                                    <input
                                      type="date"
                                      value={item.targetDate || ''}
                                      disabled={Boolean(item.targetDate)}
                                      onChange={(event) => {
                                        if (Boolean(item.targetDate)) return;
                                        handleProjectMoMActionItemChange(mom.id, index, 'targetDate', event.target.value);
                                      }}
                                      className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                                    />
                                  </div>
                                </div>
                                <div className="mt-4">
                                  <p className="text-xs uppercase tracking-wide text-slate-500">Remarks</p>
                                  <textarea
                                    rows={2}
                                    value={item.remark || ''}
                                    disabled
                                    className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No action items have been defined for this MoM.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
