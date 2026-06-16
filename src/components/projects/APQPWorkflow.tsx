import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  History,
  User as UserIcon,
  Users,
  Check,
  ChevronsUpDown
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { cn } from '../ui/utils';
import { ProjectPhase, ProjectTask, User, UserProfile } from '../../types';
import { deriveTaskStatusFromProgress, isManagerRole } from '../../mocks/projectWorkflow';
import { toast } from 'sonner';
import { canManageAssignmentsRole } from '../../utils/rbac';
import { useAppSelector } from '../../store/hooks';
import { redactIfNotAccessible } from '../../utils/visibility';

export type APQPTask = ProjectTask;
export type APQPPhase = ProjectPhase;

interface TaskUpdateDraft {
  phaseId: string;
  taskId: string;
  description: string;
  progress: string;
  files: File[];
}

interface TaskAssignDraft {
  phaseId: string;
  taskId: string;
  assigneeIds: string[];
  dueDate: string;
}

interface APQPWorkflowProps {
  phases: APQPPhase[];
  user: User;
  availableUsers: UserProfile[];
  onReassignTask: (phaseId: string, taskId: string, assigneeIds: string[], dueDate: string) => void;
  onAddTaskUpdate: (phaseId: string, taskId: string, update: { description: string; progress: number; files: File[] }) => void;
  onReviewTaskUpdate?: (phaseId: string, taskId: string, updateId: string, action: 'accepted' | 'hold' | 'not-acceptable', note?: string) => void;
  onOpenUpdateAttachment?: (phaseId: string, taskId: string, attachmentName: string) => void;
}

const PROGRESS_OPTIONS = [0, 25, 50, 75, 100];
const getStatusColor = (status: string) => {
  switch (status) {
    case 'Pending': return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'In Progress': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Completed': return 'bg-green-50 text-green-700 border-green-200';
    case 'Approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

function getTaskOwnerOptions(task: APQPTask, availableUsers: UserProfile[]) {
  return availableUsers.filter((candidate) => {
    const sameDepartment = task.departmentId ? candidate.departmentIds.includes(task.departmentId) : true;
    return candidate.status === 'Active' && sameDepartment;
  });
}

export default function APQPWorkflow({ phases, user, availableUsers, onReassignTask, onAddTaskUpdate, onReviewTaskUpdate, onOpenUpdateAttachment }: APQPWorkflowProps) {
  const [expandedPhases, setExpandedPhases] = useState<string[]>(phases[0] ? [phases[0].id] : []);
  const [updateDraft, setUpdateDraft] = useState<TaskUpdateDraft | null>(null);
  const [assignDraft, setAssignDraft] = useState<TaskAssignDraft | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAssigneeIds, setBulkAssigneeIds] = useState<string[]>([]);
  const [bulkDueDate, setBulkDueDate] = useState<string>('');
  const [historyTarget, setHistoryTarget] = useState<{ phaseId: string; task: APQPTask } | null>(null);

  const canManageAssignments = canManageAssignmentsRole(user.role);

  const expandedSet = useMemo(() => new Set(expandedPhases), [expandedPhases]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((current) =>
      current.includes(phaseId) ? current.filter((item) => item !== phaseId) : [...current, phaseId]
    );
  };

  const isTaskCompleted = (task: APQPTask) => task.status === 'Completed';
  const isTaskAssignee = (task: APQPTask) => {
    if (task.assigneeId && task.assigneeId.split(',').includes(user.id)) return true;
    if (task.assignedTo && task.assignedTo.split(', ').includes(user.name)) return true;
    return false;
  };
  const isManagerUpdater = isManagerRole(user.role);

  const orgDepartments = useAppSelector(state => state.organization.departments);
  const orgPlants = useAppSelector(state => state.organization.plants);
  const departmentMap = useMemo(() => new Map(orgDepartments.map(d => [d.id, d])), [orgDepartments]);

  const canUpdateTask = (task: APQPTask, phaseLocked: boolean) => {
    if (phaseLocked || isTaskCompleted(task)) return false;
    return isTaskAssignee(task) || isManagerUpdater;
  };

  const canReassignTask = (task: APQPTask, phaseLocked: boolean) => {
    if (phaseLocked || isTaskCompleted(task)) return false;
    return canManageAssignments;
  };

  const openAssignDialog = (phaseId: string, task: APQPTask) => {
    setAssignDraft({
      phaseId,
      taskId: task.id,
      assigneeIds: task.assigneeId ? task.assigneeId.split(',') : [],
      dueDate: task.dueDate || task.planDate || '',
    });
  };

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };

  const clearSelection = () => setSelectedTaskIds([]);

  const openBulkAssign = () => setIsBulkAssignOpen(true);

  const closeBulkAssign = () => {
    setIsBulkAssignOpen(false);
    setBulkAssigneeIds([]);
    setBulkDueDate('');
  };

  const submitBulkAssign = () => {
    if (selectedTaskIds.length === 0) {
      toast.error('No tasks selected');
      return;
    }
    if (bulkAssigneeIds.length === 0) {
      toast.error('Select at least one assignee');
      return;
    }
    if (!bulkDueDate) {
      toast.error('Select due date');
      return;
    }

    // For each selected task, find its phase and call onReassignTask
    selectedTaskIds.forEach((tid) => {
      for (const phase of phases) {
        const found = phase.tasks.find(t => t.id === tid);
        if (found) {
          onReassignTask(phase.id, tid, bulkAssigneeIds, bulkDueDate);
          break;
        }
      }
    });

    toast.success('Assigned selected tasks');
    closeBulkAssign();
    clearSelection();
  };

  const openUpdateDialog = (phaseId: string, task: APQPTask) => {
    if (!canUpdateTask(task, false)) {
      return;
    }

    setUpdateDraft({
      phaseId,
      taskId: task.id,
      description: '',
      progress: String(task.progress ?? 0),
      files: [],
    });
  };

  const submitAssignment = () => {
    if (!assignDraft?.assigneeIds || assignDraft.assigneeIds.length === 0) {
      toast.error('Please select at least one team member');
      return;
    }
    if (!assignDraft.dueDate) {
      toast.error('Please select a due date for the task');
      return;
    }

    onReassignTask(assignDraft.phaseId, assignDraft.taskId, assignDraft.assigneeIds, assignDraft.dueDate);
    setAssignDraft(null);
  };

  const submitTaskUpdate = () => {
    if (!updateDraft) return;
    if (!updateDraft.description.trim()) {
      toast.error('Work description is required');
      return;
    }

    onAddTaskUpdate(updateDraft.phaseId, updateDraft.taskId, {
      description: updateDraft.description.trim(),
      progress: Number(updateDraft.progress),
      files: updateDraft.files,
    });
    setUpdateDraft(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {phases.map((phase, index) => {
        const isExpanded = expandedSet.has(phase.id);
        const isLocked = false;

        return (
          <div
            key={phase.id}
            className={cn(
              "border rounded-xl bg-white shadow-sm transition-all duration-200",
              isExpanded ? "ring-1 ring-slate-200" : "hover:border-slate-300"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between p-4 cursor-pointer select-none rounded-xl",
                isExpanded ? "bg-slate-50/50 rounded-b-none border-b" : ""
              )}
              onClick={() => togglePhase(phase.id)}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="relative">
                  {phase.progress === 100 ? (
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 text-emerald-600">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 text-blue-600 font-bold">
                      {index + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {phase.name}
                    </h3>
                    <Badge variant="outline" className={cn("text-xs font-medium", getStatusColor(phase.status))}>
                      {phase.status}
                    </Badge>
                  </div>
                  {/* redact phase description if no task in this phase belongs to the selected plant */}
                  {(() => {
                    const selectedPlantId = (() => { try { return localStorage.getItem('selectedPlantId'); } catch (e) { return null; } })();
                    let phasePlantId: string | undefined;
                    if (selectedPlantId) {
                      const taskWithDept = phase.tasks.find(t => t.departmentId);
                      phasePlantId = taskWithDept ? departmentMap.get(taskWithDept.departmentId!)?.plantId : undefined;
                    }
                    const visible = selectedPlantId ? phase.tasks.some(t => departmentMap.get(t.departmentId || '')?.plantId === selectedPlantId) : true;
                    const desc = redactIfNotAccessible(phase.description, phasePlantId, user, orgPlants);
                    return (
                      <p className="text-sm text-slate-500 mt-1 max-w-2xl">{visible ? desc : '[redacted]'}</p>
                    );
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="w-32 hidden md:block">
                  <div className="flex justify-between text-xs mb-1.5 font-medium text-slate-600">
                    <span>Progress</span>
                    <span>{phase.progress}%</span>
                  </div>
                  <Progress value={phase.progress} className="h-2" />
                </div>

                <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform duration-200", isExpanded ? "rotate-180" : "")} />
              </div>
            </div>

            {isExpanded && (
              <div className="p-0 animate-in slide-in-from-top-2 duration-200">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="w-[4%]"></TableHead>
                      <TableHead className="w-[24%]">Task / Activity</TableHead>
                      <TableHead className="w-[12%]">Department</TableHead>
                      <TableHead className="w-[16%]">Owner</TableHead>
                      <TableHead className="w-[10%]">Plan Date</TableHead>
                      <TableHead className="w-[10%]">Due Date</TableHead>
                      <TableHead className="w-[10%]">Progress</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className="w-[10%]">Last Update</TableHead>
                      <TableHead className="w-[8%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phase.tasks.map((task) => {
                      const assigneeCanUpdate = canUpdateTask(task, phase.isLocked);
                      const managerCanReassign = canReassignTask(task, phase.isLocked);
                      const ownerOptions = getTaskOwnerOptions(task, availableUsers);
                      const dueDateValue = task.dueDate || task.planDate;
                      const isOverdue = !isTaskCompleted(task) && Boolean(dueDateValue) && new Date(dueDateValue) < new Date();

                      return (
                        <TableRow key={task.id} className="hover:bg-slate-50/50 align-top">
                          <TableCell>
                            <Checkbox checked={selectedTaskIds.includes(task.id)} onCheckedChange={() => toggleSelectTask(task.id)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-slate-700">{task.name}</span>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                {task.updates.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <History className="w-3 h-3" />
                                    {task.updates.length} update{task.updates.length > 1 ? 's' : ''}
                                  </span>
                                )}
                                {task.lastUpdated && (
                                  <span>Updated {new Date(task.lastUpdated).toLocaleDateString()} by {task.updatedBy}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] font-normal bg-slate-100 text-slate-600">
                              {task.department}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                {task.assignedTo || 'Unassigned'}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className={cn(
                              "text-sm font-medium",
                              isOverdue ? "text-red-600 flex items-center gap-1.5" : "text-slate-600"
                            )}>
                              {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                              {task.planDate || '-'}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className={cn(
                              "text-sm font-medium",
                              !task.dueDate ? "text-slate-500" : "text-slate-600"
                            )}>
                              {task.dueDate || '-'}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1.5 min-w-[90px]">
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>{task.progress}%</span>
                                {task.actualDate && <span>{task.actualDate}</span>}
                              </div>
                              <Progress value={task.progress} className="h-2" />
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className={cn("text-xs font-medium", getStatusColor(task.status))}>
                              {task.status}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            {task.updates.length > 0 ? (() => {
                              const lastUpdate = task.updates[task.updates.length - 1];
                              const taskPlantId = task.departmentId ? departmentMap.get(task.departmentId)?.plantId : undefined;
                              const isAccepted = lastUpdate.reviewStatus === 'accepted';
                              if (isAccepted) {
                                return (
                                  <div className="text-xs text-slate-500 space-y-1">
                                    <div className="font-medium text-slate-700">{lastUpdate.progress}%</div>
                                    <div>{new Date(lastUpdate.date).toLocaleString()}</div>
                                  </div>
                                );
                              }
                              const desc = redactIfNotAccessible(lastUpdate.description, taskPlantId, user, orgPlants);
                              return (
                                <div className="text-xs text-slate-500 space-y-1">
                                  <div className="font-medium text-slate-700">{desc}</div>
                                  <div>{new Date(lastUpdate.date).toLocaleString()}</div>
                                </div>
                              );
                            })() : (
                              <span className="text-sm text-slate-400">No updates yet</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      disabled={!managerCanReassign || ownerOptions.length === 0}
                                      onClick={() => openAssignDialog(phase.id, task)}
                                    >
                                      Assign Member
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {managerCanReassign ? 'Assign or reassign a department member' : 'Only Manager level and above can assign members'}
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => setHistoryTarget({ phaseId: phase.id, task })}
                                  >
                                    <FileText className="w-3.5 h-3.5 mr-1" />
                                    History
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Review task update history</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-8 text-xs bg-[#ed1c24] hover:bg-[#c4171e]"
                                      disabled={!assigneeCanUpdate}
                                      onClick={() => openUpdateDialog(phase.id, task)}
                                    >
                                      <Clock3 className="w-3.5 h-3.5 mr-1" />
                                      Update
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {assigneeCanUpdate ? 'Task update form' : 'Only the assignee or a manager can update this task'}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })}

        {/* Bulk assign toolbar */}
        {selectedTaskIds.length > 0 && (
          <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
            <div className="text-sm text-slate-700">{selectedTaskIds.length} task{selectedTaskIds.length === 1 ? '' : 's'} selected</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={clearSelection}>Clear</Button>
              <Button onClick={openBulkAssign} className="bg-[#ed1c24]">Assign Selected</Button>
            </div>
          </div>
        )}

        <Dialog open={isBulkAssignOpen} onOpenChange={(open) => !open && closeBulkAssign()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Selected Tasks</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Assignees</label>
                <div className="max-h-40 overflow-y-auto mt-2 space-y-1">
                  {availableUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer">
                      <Checkbox checked={bulkAssigneeIds.includes(u.id)} onCheckedChange={() => setBulkAssigneeIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} />
                      <div className="min-w-0 text-sm">{u.name} <div className="text-xs text-slate-400">{u.role}</div></div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Due Date</label>
                <Input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} className="w-full mt-2" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeBulkAssign}>Cancel</Button>
              <Button className="bg-[#ed1c24]" onClick={submitBulkAssign}>Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      <Dialog open={Boolean(updateDraft)} onOpenChange={(open) => !open && setUpdateDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Task Update Form</DialogTitle>
            <DialogDescription>
              Capture work completed, attach evidence, and update progress. Status will sync automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Work Description</label>
              <Textarea
                value={updateDraft?.description || ''}
                onChange={(event) => setUpdateDraft((current) => current ? { ...current, description: event.target.value } : current)}
                placeholder="Describe what was completed, what changed, and any blockers cleared."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Progress</label>
              <Select
                value={updateDraft?.progress || '0'}
                onValueChange={(value) => setUpdateDraft((current) => current ? { ...current, progress: value } : current)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRESS_OPTIONS.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}% {value === 0 ? '(Not Started)' : value === 100 ? '(Completed)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Status will become <strong>{deriveTaskStatusFromProgress(Number(updateDraft?.progress || 0))}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Attachment</label>
              <Input
                type="file"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  setUpdateDraft((current) => current ? { ...current, files } : current);
                }}
              />
              {updateDraft?.files.length ? (
                <p className="text-xs text-slate-500">{updateDraft.files.map((file) => file.name).join(', ')}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDraft(null)}>Cancel</Button>
            <Button className="bg-[#ed1c24] hover:bg-[#c4171e]" onClick={submitTaskUpdate}>Save Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assignDraft)} onOpenChange={(open) => !open && setAssignDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Member</DialogTitle>
            <DialogDescription>
              Choose the department member who should own this APQP task.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Team Members</label>
              {(() => {
                const task = phases
                  .flatMap((phase) => phase.tasks.map((phaseTask) => ({ phaseId: phase.id, task: phaseTask })))
                  .find((item) => item.phaseId === assignDraft?.phaseId && item.task.id === assignDraft?.taskId)?.task;
                const ownerOptions = task ? getTaskOwnerOptions(task, availableUsers) : [];
                const selectedAssignees = ownerOptions.filter(candidate => assignDraft?.assigneeIds.includes(candidate.id));

                return (
                  <div className="flex flex-col space-y-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between bg-white hover:bg-slate-50 text-left font-normal"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Users className="h-4 w-4 text-slate-500" />
                            {selectedAssignees.length > 0
                              ? `${selectedAssignees.length} member${selectedAssignees.length > 1 ? 's' : ''} selected`
                              : 'Select members'}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" side="bottom" align="start" sideOffset={4} avoidCollisions={false}>
                        <Command>
                          <CommandInput placeholder="Search members..." />
                          <CommandList>
                            <CommandEmpty>No members found.</CommandEmpty>
                            <CommandGroup>
                              {ownerOptions.map((candidate) => (
                                <CommandItem
                                  key={candidate.id}
                                  value={`${candidate.name} ${candidate.role}`}
                                  onSelect={() => {
                                    if (!assignDraft) return;
                                    const isSelected = assignDraft.assigneeIds.includes(candidate.id);
                                    const nextIds = isSelected
                                      ? assignDraft.assigneeIds.filter(id => id !== candidate.id)
                                      : [...assignDraft.assigneeIds, candidate.id];
                                    setAssignDraft({ ...assignDraft, assigneeIds: nextIds });
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      assignDraft?.assigneeIds.includes(candidate.id) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate">{candidate.name}</span>
                                    <span className="text-xs text-slate-500 truncate">{candidate.role}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {selectedAssignees.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedAssignees.map((member) => (
                          <Badge key={member.id} variant="secondary" className="bg-slate-100 text-slate-700">
                            {member.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Due Date</label>
              <Input
                type="date"
                value={assignDraft?.dueDate || ''}
                onChange={(event) => setAssignDraft((current) => current ? { ...current, dueDate: event.target.value } : current)}
                className="w-full bg-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDraft(null)}>Cancel</Button>
            <Button className="bg-[#ed1c24] hover:bg-[#c4171e]" onClick={submitAssignment}>Assign Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyTarget)} onOpenChange={(open) => !open && setHistoryTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{historyTarget?.task.name}</DialogTitle>
            <DialogDescription>
              Full ownership and execution trail for this task.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {historyTarget?.task.updates.length ? historyTarget.task.updates.slice().reverse().map((update) => (
              <div key={update.id} className="border rounded-xl p-4 space-y-2 bg-slate-50">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium text-slate-900">{update.updatedBy}</div>
                  <Badge variant="outline" className={cn("text-xs", getStatusColor(update.status))}>
                    {update.progress}% • {update.status}
                  </Badge>
                </div>
                {/* redact update descriptions if task's department maps to an inaccessible plant */}
                <p className="text-sm text-slate-700">{(() => {
                  const taskPlantId = historyTarget?.task.departmentId ? departmentMap.get(historyTarget.task.departmentId)?.plantId : undefined;
                  return redactIfNotAccessible(update.description, taskPlantId, user, orgPlants);
                })()}</p>
                {update.reviewStatus !== 'accepted' && update.attachments.length > 0 && (
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-slate-500">Attachments: {update.attachments.join(', ')}</p>
                    {update.attachments.map((att) => (
                      <Button key={att} variant="ghost" size="sm" onClick={() => onOpenUpdateAttachment && historyTarget && onOpenUpdateAttachment(historyTarget.phaseId, historyTarget.task.id, att)}>View</Button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-400">{new Date(update.date).toLocaleString()}</p>

                {/* Review status and manager actions */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {update.reviewStatus ? (
                      <span>Review: {update.reviewStatus}{update.reviewedBy ? ` • by ${update.reviewedBy}` : ''}{update.reviewedAt ? ` • ${new Date(update.reviewedAt).toLocaleString()}` : ''}</span>
                    ) : (
                      <span>Review: pending</span>
                    )}
                  </div>
                  {isManagerUpdater && update.reviewStatus === 'pending' && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => onReviewTaskUpdate && historyTarget && onReviewTaskUpdate(historyTarget.phaseId, historyTarget.task.id, update.id, 'accepted')}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => onReviewTaskUpdate && historyTarget && onReviewTaskUpdate(historyTarget.phaseId, historyTarget.task.id, update.id, 'hold')}>Hold</Button>
                      <Button size="sm" variant="destructive" onClick={() => onReviewTaskUpdate && historyTarget && onReviewTaskUpdate(historyTarget.phaseId, historyTarget.task.id, update.id, 'not-acceptable')}>Not Acceptable</Button>
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div className="text-sm text-slate-500 text-center py-8">
                No updates have been logged for this task yet.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
