import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Download, Edit, Loader2, Plus, Trash2, Upload } from 'lucide-react';
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
import { getAccessiblePlantIds } from '../utils/projectAccess';
import { redactIfNotAccessible } from '../utils/visibility';
import {
  addTaskTemplate,
  deleteTaskTemplate,
  fetchTaskTemplates,
  updateTaskTemplate,
  fetchTaskGroups,
  addTaskGroupThunk,
  deleteTaskGroupThunk,
  updateTaskGroupThunk,
} from '../features/tasks/taskSlice';
import { fetchOrganizationData } from '../features/organization/organizationSlice';
import { TaskTemplate, TaskGroup } from '../types';

interface TaskManagementProps {
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

const DEFAULT_PHASES = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'];
const CSV_HEADERS = ['Task Name', 'Department Codes', 'Phase', 'Description', 'Supporting Document', 'Task Type', 'CFT Team'];
const CSV_TEMPLATE_SAMPLE = [
  'APQP Kickoff Review',
  'ENG|QA',
  'Phase 1',
  'Review APQP kickoff readiness with responsible departments',
  'APQP checklist',
  'Standard',
  '',
];

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

const normalizeCsvHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const escapeCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const parseCsvText = (csvText: string) => {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  return lines.map(parseCsvLine);
};

export default function TaskManagement({ user, onNavigate, onLogout }: TaskManagementProps) {
  const dispatch = useAppDispatch();
  const { tasks, groups, loading } = useAppSelector((state) => state.tasks);
  const organizationState = useAppSelector((state) => state.organization);
  const departments = organizationState.departments;
  const plants = organizationState.plants;

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
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [groupTaskSearch, setGroupTaskSearch] = useState('');
  const [editingGroup, setEditingGroup] = useState<TaskGroup | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupPhase, setEditingGroupPhase] = useState('');
  const [editingGroupTaskIds, setEditingGroupTaskIds] = useState<string[]>([]);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<TaskGroup | null>(null);

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
    dispatch(fetchTaskGroups());
  }, [departments.length, dispatch, organizationState.loading, tasks.length]);

  const departmentMap = useMemo(
    () => new Map(departments.map((dept) => [dept.id, dept])),
    [departments]
  );

  const accessiblePlantIds = useMemo(() => getAccessiblePlantIds(user, plants), [plants, user]);
  const selectedPlantId = (() => { try { return localStorage.getItem('selectedPlantId'); } catch (e) { return null; } })();

  const availablePhases = useMemo(() => {
    const taskPhases = tasks.map((task) => task.phase).filter(Boolean);
    return Array.from(new Set([...DEFAULT_PHASES, ...taskPhases])).filter(Boolean);
  }, [tasks]);

  const getTaskDepartmentIds = (task: TaskTemplate) =>
    task.departmentIds?.length ? task.departmentIds : task.departmentId ? [task.departmentId] : [];

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      // enforce plant-level isolation: tasks must belong to a department mapped to an accessible plant
      const taskDeptIds = getTaskDepartmentIds(task);
      const taskPlantIds = taskDeptIds.map((id) => departmentMap.get(id)?.plantId).filter(Boolean) as string[];
      const isPlantVisible = taskPlantIds.length === 0 ? false : taskPlantIds.some((pid) => accessiblePlantIds.includes(pid));
      // if a specific plant is selected, limit visibility to that plant only
      if (selectedPlantId && accessiblePlantIds.includes(selectedPlantId)) {
        const matchesSelected = taskPlantIds.some((pid) => pid === selectedPlantId);
        if (!matchesSelected) return false;
      }
      if (!isPlantVisible) return false;

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

  const handleTaskDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
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

  const handleSelectAllGroupTasks = () => {
    if (groupTaskIds.length === filteredGroupTasks.length) {
      setGroupTaskIds([]);
    } else {
      setGroupTaskIds(filteredGroupTasks.map((t) => t.id));
    }
  };

  const handleSelectAllEditingGroupTasks = () => {
    if (editingGroupTaskIds.length === filteredGroupTasks.length) {
      setEditingGroupTaskIds([]);
    } else {
      setEditingGroupTaskIds(filteredGroupTasks.map((t) => t.id));
    }
  };

  const openGroupDialog = () => {
    setGroupName('');
    setGroupPhase('Phase 1');
    setGroupTaskIds([]);
    setGroupTaskSearch('');
    setIsGroupDialogOpen(true);
  };

  const closeGroupDialog = () => {
    setIsGroupDialogOpen(false);
    setGroupName('');
    setGroupPhase('Phase 1');
    setGroupTaskIds([]);
    setGroupTaskSearch('');
  };

  const filteredGroupTasks = useMemo(() => {
    const query = groupTaskSearch.trim().toLowerCase();
    return tasks.filter((task) => {
      if (!query) return true;
      return task.name.toLowerCase().includes(query) || task.phase.toLowerCase().includes(query);
    });
  }, [groupTaskSearch, tasks]);

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
      await dispatch(addTaskGroupThunk({
        name: groupName.trim(),
        phase: groupPhase,
        taskIds: groupTaskIds,
      })).unwrap();
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

  const handleEditGroup = (group: TaskGroup) => {
    setEditingGroup(group);
    setEditingGroupName(group.name);
    setEditingGroupPhase(group.phase);
    setEditingGroupTaskIds(group.taskIds);
    setIsEditingGroup(true);
  };

  const handleDeleteGroup = (group: TaskGroup) => {
    setGroupToDelete(group);
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeletingGroup(true);
    try {
      await dispatch(deleteTaskGroupThunk(groupToDelete.id)).unwrap();
      toast.success('Task group deleted successfully');
      setGroupToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete task group');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const handleSaveEditingGroup = async () => {
    if (!editingGroup) return;
    if (!editingGroupName.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (editingGroupTaskIds.length === 0) {
      toast.error('Select at least one task for this group');
      return;
    }

    setIsEditingGroup(true);
    try {
      const updatedGroup: TaskGroup = {
        id: editingGroup.id,
        name: editingGroupName.trim(),
        phase: editingGroupPhase,
        taskIds: editingGroupTaskIds,
      };
      await dispatch(updateTaskGroupThunk(updatedGroup)).unwrap();
      toast.success('Task group updated successfully');
      setEditingGroup(null);
      setEditingGroupName('');
      setEditingGroupPhase('');
      setEditingGroupTaskIds([]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update task group');
    } finally {
      setIsEditingGroup(false);
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

  const handleDownloadCsvTemplate = () => {
    const csvContent = [
      CSV_HEADERS.map(escapeCsvCell).join(','),
      CSV_TEMPLATE_SAMPLE.map(escapeCsvCell).join(','),
    ].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Task_Template_Bulk_Upload.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resolveDepartmentIds = (departmentCodes: string) => {
    const tokens = departmentCodes
      .split(/[|;]/)
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);

    return tokens
      .map((token) => departments.find((dept) =>
        dept.id.toLowerCase() === token ||
        dept.code.toLowerCase() === token ||
        dept.name.toLowerCase() === token
      )?.id)
      .filter((id): id is string => Boolean(id));
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file.');
      return;
    }

    if (departments.length === 0) {
      toast.error('Departments must be loaded before bulk importing task templates.');
      return;
    }

    setIsBulkImporting(true);
    try {
      const csvText = await file.text();
      const parsedRows = parseCsvText(csvText);
      const headerRow = parsedRows[0] || [];
      const dataRows = parsedRows.slice(1);
      const normalizedHeaders = headerRow.map(normalizeCsvHeader);
      const headerIndex = new Map(normalizedHeaders.map((header, index) => [header, index]));
      const missingHeaders = CSV_HEADERS.filter((header) => !headerIndex.has(normalizeCsvHeader(header)));

      if (missingHeaders.length > 0) {
        toast.error(`Missing CSV headers: ${missingHeaders.join(', ')}`);
        return;
      }

      if (dataRows.length === 0) {
        toast.error('No task template rows found in the CSV.');
        return;
      }

      const errors: string[] = [];
      const payloads = dataRows.map((row, index) => {
        const getValue = (header: string) => row[headerIndex.get(normalizeCsvHeader(header)) ?? -1]?.trim() || '';
        const name = getValue('Task Name');
        const phase = getValue('Phase');
        const departmentIds = resolveDepartmentIds(getValue('Department Codes'));
        const taskType = getValue('Task Type').toLowerCase();

        if (!name) errors.push(`Row ${index + 2}: Task Name is required.`);
        if (departmentIds.length === 0) errors.push(`Row ${index + 2}: Department Codes must match an existing department ID, code, or name.`);
        if (!phase) errors.push(`Row ${index + 2}: Phase is required.`);

        return {
          name,
          departmentId: departmentIds[0] || '',
          departmentIds,
          phase,
          description: getValue('Description'),
          supportingDoc: getValue('Supporting Document'),
          isCftTask: taskType.includes('cft'),
          cftTeam: getValue('CFT Team'),
        };
      });

      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join(' '));
        return;
      }

      for (const payload of payloads) {
        await dispatch(addTaskTemplate(payload)).unwrap();
      }

      toast.success(`${payloads.length} task template${payloads.length === 1 ? '' : 's'} imported successfully.`);
    } catch (err: any) {
      toast.error(err || 'Failed to import task templates from CSV.');
    } finally {
      setIsBulkImporting(false);
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
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {loading ? (
                  <Skeleton className="h-9 w-40 rounded-md" />
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleDownloadCsvTemplate}
                      disabled={isBulkImporting}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV Template
                    </Button>
                    <Input
                      id="task-template-csv-upload"
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleCsvUpload}
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('task-template-csv-upload')?.click()}
                      disabled={departments.length === 0 || isBulkImporting}
                    >
                      {isBulkImporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Bulk Upload CSV
                    </Button>
                    <Button
                      onClick={handleAddTask}
                      style={{ backgroundColor: '#ed1c24' }}
                      disabled={departments.length === 0 || isSaving || isBulkImporting}
                    >
                      {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Add Task Template
                    </Button>
                    <Button
                      onClick={openGroupDialog}
                      variant="outline"
                      style={{ borderColor: '#ed1c24', color: '#ed1c24' }}
                      disabled={tasks.length === 0}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Group
                    </Button>
                  </>
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
                              {/* determine plant for this task via department mapping and redact if not accessible */}
                              {(() => {
                                const taskDeptIds = getTaskDepartmentIds(task);
                                const taskPlantId = taskDeptIds.map((id) => departmentMap.get(id)?.plantId).filter(Boolean)[0];
                                const visibleDesc = redactIfNotAccessible(task.description || '', taskPlantId, user, plants);
                                return <TableCell className="max-w-xs truncate">{visibleDesc || '-'}</TableCell>;
                              })()}
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

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Task Groups</p>
                  <p className="text-xs text-slate-500">Groups created for APQP planning and task bundles.</p>
                </div>
                <Badge variant="outline" className="bg-white text-slate-700">
                  {groups.length} group{groups.length === 1 ? '' : 's'}
                </Badge>
              </div>

              {groups.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-500">
                  No task groups have been defined yet.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {groups.map((group) => {
                    const taskNames = group.taskIds.map((taskId) => tasks.find((task) => task.id === taskId)?.name || taskId);
                    return (
                      <div key={group.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{group.name}</p>
                            <p className="text-xs text-slate-500">
                              Phase: {group.phase} · {group.taskIds.length} task{group.taskIds.length === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleEditGroup(group)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteGroup(group)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {taskNames.map((name, index) => (
                            <Badge key={`${group.id}-${index}`} variant="secondary" className="bg-slate-100 text-slate-700 text-[11px]">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleTaskDialogOpenChange}>
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-3xl p-0 gap-0 flex flex-col overflow-hidden"
          style={{ height: 'min(780px, calc(100vh - 2rem))' }}
        >
          <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-6">
            <div className="flex items-center justify-between gap-3 py-4 pr-8">
              <DialogTitle className="text-lg">{editingTask ? 'Edit Task Template' : 'Add Task Template'}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-base">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Task Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Task name"
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Departments *</Label>
                <Popover open={isDeptPickerOpen} onOpenChange={setIsDeptPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 w-full justify-between text-left text-sm"
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
                      className="space-y-1 overflow-y-auto overscroll-contain p-2 scrollbar-thin scrollbar-thumb-slate-400/70"
                      style={{ maxHeight: 'min(320px, var(--radix-popover-content-available-height))' }}
                    >
                      {departments.filter(d => accessiblePlantIds.includes(d.plantId)).map((d) => {
                        const checked = formData.departmentIds.includes(d.id);
                        return (
                          <label
                            key={d.id}
                            className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100 cursor-pointer text-sm"
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
                              <div className="truncate font-medium">{d.name}</div>
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
                  <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select phase" /></SelectTrigger>
                  <SelectContent>
                    {availablePhases.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Task Type *</Label>
                <Select value={formData.isCftTask ? 'cft' : 'standard'} onValueChange={(value) => setFormData({ ...formData, isCftTask: value === 'cft' })}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select task type" /></SelectTrigger>
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
                  className="h-10 text-sm"
                />
              </div>

              {formData.isCftTask && (
                <div className="space-y-2 md:col-span-2">
                  <Label>CFT Team</Label>
                  <Input
                    value={formData.cftTeam}
                    onChange={(e) => setFormData({ ...formData, cftTeam: e.target.value })}
                    placeholder="Enter CFT team name or tag"
                    className="h-10 text-sm"
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
                  className="text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-6 py-5">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSaveTask} style={{ backgroundColor: '#ed1c24' }} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTask ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={isGroupDialogOpen} onOpenChange={(open) => !open && closeGroupDialog()}>
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-3xl p-0 gap-0 flex flex-col overflow-hidden"
          style={{ height: 'min(760px, calc(100vh - 2rem))' }}
        >
          <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-6">
            <div className="flex items-center justify-between gap-3 py-4 pr-8">
              <DialogTitle className="text-base">Create Task Group</DialogTitle>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden px-6 py-5 flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label>Group Name *</Label>
                <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="h-9 text-sm" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Search Tasks</Label>
              <Input
                value={groupTaskSearch}
                onChange={(e) => setGroupTaskSearch(e.target.value)}
                placeholder="Search by name or phase"
                className="h-9 text-sm"
              />
            </div>

            <div className="min-h-0 flex flex-1 flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Checkbox
                    className="h-4 w-4"
                    checked={groupTaskIds.length === filteredGroupTasks.length && filteredGroupTasks.length > 0}
                    indeterminate={groupTaskIds.length > 0 && groupTaskIds.length < filteredGroupTasks.length}
                    onCheckedChange={handleSelectAllGroupTasks}
                  />
                  <span>{filteredGroupTasks.length} tasks found</span>
                </div>
                <span>{groupTaskIds.length} selected</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto border border-slate-200 rounded-lg p-1">
                {filteredGroupTasks.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No matching tasks. Try a different search term.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {filteredGroupTasks.map((t) => (
                      <label
                        key={t.id}
                        className="flex min-h-[58px] items-start gap-2 rounded-md p-2 hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200"
                        title={t.name}
                      >
                        <Checkbox
                          className="mt-1 shrink-0"
                          checked={groupTaskIds.includes(t.id)}
                          onCheckedChange={() => handleToggleGroupTask(t.id)}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-sm leading-snug line-clamp-2">{t.name}</div>
                          <div className="text-[11px] text-slate-500">{t.phase}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-6 py-5">
            <Button variant="outline" onClick={closeGroupDialog} disabled={isCreatingGroup}>Cancel</Button>
            <Button onClick={handleCreateGroup} style={{ backgroundColor: '#ed1c24' }} disabled={isCreatingGroup}>
              {isCreatingGroup ? 'Adding...' : 'Add Selected'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-3xl p-0 gap-0 flex flex-col overflow-hidden"
          style={{ height: 'min(760px, calc(100vh - 2rem))' }}
        >
          <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-6">
            <div className="flex items-center justify-between gap-3 py-4 pr-8">
              <DialogTitle className="text-base">Edit Task Group</DialogTitle>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden px-6 py-5 flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label>Group Name *</Label>
                <Input 
                  value={editingGroupName} 
                  onChange={(e) => setEditingGroupName(e.target.value)} 
                  placeholder="Group name" 
                  className="h-9 text-sm" 
                />
              </div>
              <div className="space-y-1">
                <Label>Phase *</Label>
                <Select value={editingGroupPhase} onValueChange={setEditingGroupPhase}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePhases.map((phase) => (
                      <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Search Tasks</Label>
              <Input
                value={groupTaskSearch}
                onChange={(e) => setGroupTaskSearch(e.target.value)}
                placeholder="Search by name or phase"
                className="h-9 text-sm"
              />
            </div>

            <div className="min-h-0 flex flex-1 flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Checkbox
                    className="h-4 w-4"
                    checked={editingGroupTaskIds.length === filteredGroupTasks.length && filteredGroupTasks.length > 0}
                    indeterminate={editingGroupTaskIds.length > 0 && editingGroupTaskIds.length < filteredGroupTasks.length}
                    onCheckedChange={handleSelectAllEditingGroupTasks}
                  />
                  <span>{filteredGroupTasks.length} tasks found</span>
                </div>
                <span>{editingGroupTaskIds.length} selected</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto border border-slate-200 rounded-lg p-1">
                {filteredGroupTasks.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No matching tasks. Try a different search term.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {filteredGroupTasks.map((t) => (
                      <label
                        key={t.id}
                        className="flex min-h-[58px] items-start gap-2 rounded-md p-2 hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200"
                        title={t.name}
                      >
                        <Checkbox
                          className="mt-1 shrink-0"
                          checked={editingGroupTaskIds.includes(t.id)}
                          onCheckedChange={() => {
                            setEditingGroupTaskIds((prev) =>
                              prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                            );
                          }}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-sm leading-snug line-clamp-2">{t.name}</div>
                          <div className="text-[11px] text-slate-500">{t.phase}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-6 py-5">
            <Button variant="outline" onClick={() => setEditingGroup(null)} disabled={isEditingGroup}>Cancel</Button>
            <Button onClick={handleSaveEditingGroup} style={{ backgroundColor: '#ed1c24' }} disabled={isEditingGroup}>
              {isEditingGroup ? 'Saving...' : 'Save Changes'}
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

      {/* Delete Task Group Confirmation Modal */}
      <Dialog open={!!groupToDelete} onOpenChange={(open) => { if (!open && !isDeletingGroup) setGroupToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Task Group
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-slate-900">"{groupToDelete?.name}"</span>?
            <p className="mt-1 text-slate-500">This action cannot be undone.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setGroupToDelete(null)}
              disabled={isDeletingGroup}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteGroup}
              disabled={isDeletingGroup}
              style={{ backgroundColor: '#ed1c24' }}
            >
              {isDeletingGroup ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
