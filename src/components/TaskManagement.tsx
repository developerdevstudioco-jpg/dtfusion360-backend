import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Edit, Loader2, Plus, Trash2 } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { User, Page } from '../App';
import Layout from './Layout';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addTaskTemplate,
  deleteTaskTemplate,
  fetchTaskTemplates,
  updateTaskTemplate,
  addTaskGroup,
  deleteTaskGroup,
} from '../features/tasks/taskSlice';
import { fetchOrganizationData } from '../features/organization/organizationSlice';
import { TaskTemplate, TaskGroup } from '../types';

interface TaskManagementProps {
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

const DEFAULT_PHASES = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'];

const getPhaseColor = (phase: string) => {
  const colors: Record<string, string> = {
    'Phase 1': '#2563eb',
    'Phase 2': '#16a34a',
    'Phase 3': '#f59e0b',
    'Phase 4': '#ea580c',
    'Phase 5': '#7c3aed',
  };
  return colors[phase] || '#64748b';
};

export default function TaskManagement({ user, onNavigate, onLogout }: TaskManagementProps) {
  const dispatch = useAppDispatch();
  const { tasks, groups, loading } = useAppSelector((state) => state.tasks);
  const organizationState = useAppSelector((state) => state.organization);
  const departments = organizationState.departments;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<TaskTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupPhase, setGroupPhase] = useState('Phase 1');
  const [groupTaskIds, setGroupTaskIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isDeptPickerOpen, setIsDeptPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    departmentId: '',
    departmentIds: [] as string[],
    phase: '',
    description: '',
    supportingDoc: '',
    isCftTask: false,
    cftTeam: '',
  });

  useEffect(() => {
    if (tasks.length === 0) {
      dispatch(fetchTaskTemplates());
    }
    if (departments.length === 0 && !organizationState.loading) {
      dispatch(fetchOrganizationData());
    }
  }, [departments.length, dispatch, organizationState.loading, tasks.length]);

  const departmentMap = useMemo(
    () => new Map(departments.map((dept) => [dept.id, dept])),
    [departments]
  );

  const availablePhases = useMemo(() => {
    const taskPhases = tasks.map((task) => task.phase).filter(Boolean);
    return Array.from(new Set([...DEFAULT_PHASES, ...taskPhases])).filter(Boolean);
  }, [tasks]);

  const getTaskDepartmentIds = (task: TaskTemplate) =>
    task.departmentIds?.length ? task.departmentIds : task.departmentId ? [task.departmentId] : [];

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !normalizedSearch ||
        task.name.toLowerCase().includes(normalizedSearch) ||
        (task.description || '').toLowerCase().includes(normalizedSearch) ||
        (task.supportingDoc || '').toLowerCase().includes(normalizedSearch);

      const taskDepartmentIds = getTaskDepartmentIds(task);
      const matchesDepartment =
        departmentFilter === 'all' || taskDepartmentIds.includes(departmentFilter);
      const matchesPhase = phaseFilter === 'all' || task.phase === phaseFilter;

      return matchesSearch && matchesDepartment && matchesPhase;
    });
  }, [departmentFilter, phaseFilter, searchTerm, tasks]);

  const activeDepartmentCount = useMemo(() => {
    return new Set(tasks.flatMap((task) => getTaskDepartmentIds(task)).filter(Boolean)).size;
  }, [tasks]);

  const resetForm = () => {
    setEditingTask(null);
    setFormData({
      name: '',
      departmentId: '',
      departmentIds: [],
      phase: '',
      description: '',
      supportingDoc: '',
      isCftTask: false,
      cftTeam: '',
    });
  };

  const handleAddTask = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditTask = (task: TaskTemplate) => {
    setEditingTask(task);
    setFormData({
      name: task.name || '',
      departmentId: task.departmentId || '',
      departmentIds: task.departmentIds || (task.departmentId ? [task.departmentId] : []),
      phase: task.phase || '',
      description: task.description || '',
      supportingDoc: task.supportingDoc || '',
      isCftTask: !!task.isCftTask,
      cftTeam: task.cftTeam || '',
    });
    setIsDialogOpen(true);
  };

  const handleDeleteTask = (task: TaskTemplate) => {
    setDeleteTarget(task);
  };

  const handleToggleGroupTask = (taskId: string) => {
    setGroupTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  };

  const openGroupDialog = () => {
    setGroupName('');
    setGroupPhase('Phase 1');
    setGroupTaskIds(tasks.filter((task) => task.phase === 'Phase 1').map((task) => task.id));
    setIsGroupDialogOpen(true);
  };

  const closeGroupDialog = () => {
    setIsGroupDialogOpen(false);
    setGroupName('');
    setGroupPhase('Phase 1');
    setGroupTaskIds([]);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (groupTaskIds.length === 0) {
      toast.error('Select at least one task for this group');
      return;
    }

    setIsCreatingGroup(true);
    try {
      dispatch(addTaskGroup({
        id: crypto?.randomUUID?.() ?? `group-${Date.now()}`,
        name: groupName.trim(),
        phase: groupPhase,
        taskIds: groupTaskIds,
      }));
      toast.success('Task group created successfully');
      closeGroupDialog();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create task group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteTaskTemplate(deleteTarget.id)).unwrap();
      toast.success('Task template deleted successfully');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err || 'Failed to delete task template');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveTask = async () => {
    const departmentIds = formData.departmentIds.length > 0 ? formData.departmentIds : formData.departmentId ? [formData.departmentId] : [];
    const payload = {
      name: formData.name.trim(),
      departmentId: departmentIds[0] || formData.departmentId,
      departmentIds,
      phase: formData.phase,
      description: formData.description.trim(),
      supportingDoc: formData.supportingDoc.trim(),
      isCftTask: formData.isCftTask,
      cftTeam: formData.cftTeam,
    };

    if (!payload.name || departmentIds.length === 0 || !payload.phase) {
      toast.error('Please fill in Task Name, Departments, and Phase');
      return;
    }

    setIsSaving(true);
    try {
      if (editingTask) {
        await dispatch(updateTaskTemplate({ ...editingTask, ...payload })).unwrap();
        toast.success('Task template updated successfully');
      } else {
        await dispatch(addTaskTemplate(payload)).unwrap();
        toast.success('Task template created successfully');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err || 'Failed to save task template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout user={user} currentPage="tasks" onNavigate={onNavigate} onLogout={onLogout} title="Task Template Master">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[{ label: 'Total Templates', value: tasks.length }, { label: 'Departments Used', value: activeDepartmentCount }, { label: 'Phases Covered', value: availablePhases.length }].map(({ label, value }) => (
            <Card key={label} className="border-slate-200 shadow-sm">
              <CardContent className="pt-6">
                <div className="text-sm font-medium text-slate-500">{label}</div>
                {loading ? (
                  <Skeleton className="mt-3 h-8 w-16" />
                ) : (
                  <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card style={{ borderRadius: '12px' }}>
          <CardHeader className="w-full">
            <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center">
              <div className="ml-auto">
                {loading ? (
                  <Skeleton className="h-9 w-40 rounded-md" />
                ) : (
                  <Button
                    onClick={handleAddTask}
                    style={{ backgroundColor: '#ed1c24' }}
                    disabled={departments.length === 0 || isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add Task Template
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by task, description..."
              />

              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Phases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  {availablePhases.map((phase) => (
                    <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                            <TableHead>Task Template</TableHead>
                    <TableHead>Departments</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Supporting Document</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28 mb-1" />
                          <Skeleton className="h-3 w-16" />
                        </TableCell>
                        <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-16 rounded-md" />
                            <Skeleton className="h-8 w-18 rounded-md" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-slate-500">No results found.</TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task) => {
                      const taskDepartments = getTaskDepartmentIds(task).map((id) => departmentMap.get(id)).filter(Boolean);
                      const departmentLabel = taskDepartments.length > 0
                        ? taskDepartments.map((dept) => dept?.name).join(', ')
                        : 'Unmapped';
                      const isThisDeleting = isDeleting && deleteTarget?.id === task.id;
                      return (
                        <TableRow key={task.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{task.name}</TableCell>
                          <TableCell>
                            {taskDepartments.length > 0 ? (
                              <div>
                                <div className="font-medium truncate">{taskDepartments.map((dept) => dept?.name).join(', ')}</div>
                                <div className="text-xs text-slate-500">{taskDepartments.map((dept) => dept?.code).join(', ')}</div>
                              </div>
                            ) : (
                              <Badge variant="outline">Unmapped</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize" style={{ borderColor: task.isCftTask ? '#a855f7' : getPhaseColor(task.phase), color: task.isCftTask ? '#7c3aed' : getPhaseColor(task.phase) }}>
                              {task.isCftTask ? 'CFT Task' : 'Standard'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" style={{ borderColor: getPhaseColor(task.phase), color: getPhaseColor(task.phase) }}>
                              {task.phase || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{task.description || '-'}</TableCell>
                          <TableCell>{task.supportingDoc || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditTask(task)}
                                disabled={isSaving || isDeleting}
                              >
                                {isSaving && editingTask?.id === task.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Edit className="h-4 w-4 mr-1" />
                                )}
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTask(task)}
                                disabled={isDeleting || isSaving}
                              >
                                {isThisDeleting ? (
                                  <Loader2 className="h-4 w-4 text-red-600 mr-1 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-red-600 mr-1" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()} >
        <DialogContent className="max-w-2xl overflow-visible">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task Template' : 'Add Task Template'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Task Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Task name"
              />
            </div>
            <div className="relative z-20 space-y-2 md:col-span-2">
              <Label>Departments *</Label>
              <Popover open={isDeptPickerOpen} onOpenChange={setIsDeptPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left"
                    disabled={departments.length === 0}
                  >
                    <span className="truncate max-w-[calc(100%-2rem)]">
                      {formData.departmentIds.length > 0
                        ? departments
                            .filter((dept) => formData.departmentIds.includes(dept.id))
                            .map((dept) => dept.name)
                            .join(', ')
                        : 'Select departments'}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  disablePortal
                  className="overflow-hidden p-0"
                  align="start"
                  sideOffset={8}
                  collisionPadding={16}
                  style={{
                    zIndex: 1000,
                    width: 'var(--radix-popover-trigger-width)',
                    maxHeight: 'min(320px, var(--radix-popover-content-available-height))',
                  }}
                >
                  <div
                    className="space-y-2 overflow-y-auto overscroll-contain p-3 scrollbar-thin scrollbar-thumb-slate-400/70"
                    style={{ maxHeight: 'min(320px, var(--radix-popover-content-available-height))' }}
                  >
                    {departments.map((d) => {
                      const checked = formData.departmentIds.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-100 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(checked) => {
                              const isChecked = checked === true;
                              setFormData((prev) => ({
                                ...prev,
                                departmentIds: isChecked
                                  ? [...new Set([...prev.departmentIds, d.id])]
                                  : prev.departmentIds.filter((id) => id !== d.id),
                              }));
                            }}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{d.name}</div>
                            <div className="text-[11px] text-slate-500 truncate">{d.code}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              {formData.departmentIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {departments
                    .filter((dept) => formData.departmentIds.includes(dept.id))
                    .map((dept) => (
                      <Badge key={dept.id} variant="secondary" className="bg-slate-100 text-slate-700 px-2 py-1 text-[11px]">
                        {dept.name}
                      </Badge>
                    ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Phase *</Label>
              <Select value={formData.phase} onValueChange={(v) => setFormData({ ...formData, phase: v })}>
                <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  {availablePhases.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Task Type *</Label>
              <Select value={formData.isCftTask ? 'cft' : 'standard'} onValueChange={(value) => setFormData({ ...formData, isCftTask: value === 'cft' })}>
                <SelectTrigger><SelectValue placeholder="Select task type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="cft">CFT Team Task</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Supporting Document</Label>
              <Input
                value={formData.supportingDoc}
                onChange={(e) => setFormData({ ...formData, supportingDoc: e.target.value })}
                placeholder="Ref documents"
              />
            </div>
            {formData.isCftTask && (
              <div className="space-y-2 md:col-span-2">
                <Label>CFT Team</Label>
                <Input
                  value={formData.cftTeam}
                  onChange={(e) => setFormData({ ...formData, cftTeam: e.target.value })}
                  placeholder="Enter CFT team name or tag"
                />
                <p className="text-xs text-slate-500">
                  When this task is selected in a project, it will be auto-assigned to the project's selected CFT members.
                </p>
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Task description..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSaveTask} style={{ backgroundColor: '#ed1c24' }} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTask ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Task Template
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-slate-900">"{deleteTarget?.name}"</span>?
            <p className="mt-1 text-slate-500">This action cannot be undone.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={isDeleting}
              style={{ backgroundColor: '#ed1c24' }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
