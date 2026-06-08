import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Upload, AlertTriangle, CheckCircle2, ChevronRight, Save, Check, ChevronsUpDown, Users, Loader2 } from 'lucide-react';
import { User, Page } from '../../types';
import Layout from '../Layout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchOrganizationData } from '../../features/organization/organizationSlice';
import { fetchTaskTemplates } from '../../features/tasks/taskSlice';
import { fetchUsers } from '../../features/users/userSlice';
import { createProject, updateProject, requestProjectUpdate } from '../../features/projects/projectSlice';
import { addNotifications } from '../../features/notifications/notificationSlice';
import { Project, ProjectDR } from '../../types';
import { createWorkflowTasks, summarizeProjectWorkflow } from '../../mocks/projectWorkflow';
import { isProjectCreationDepartmentName, isProjectCreationDepartmentUser, isResearchDepartmentName, normalizeRoleKey } from '../../utils/rbac';
import { filterUsersByPlantAccess, getAccessiblePlantIds } from '../../utils/projectAccess';


interface ProjectFormProps {
  user: User;
  onNavigate: (page: Page) => void;
  onCancel: () => void;
  onLogout: () => void;
  editProjectId?: string;
}

const steps = ['Project Details', 'DR & Compliance', 'APQP Scope', 'Review'];
const PROJECT_NOTIFICATION_ROLE_KEYS = new Set(['manager', 'deputymanager', 'assistantmanager']);

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function ProjectForm({ user, onNavigate, onCancel, onLogout, editProjectId }: ProjectFormProps) {
  const dispatch = useAppDispatch();
  const plants = useAppSelector(state => state.organization.plants);
  const departments = useAppSelector(state => state.organization.departments);
  const taskTemplates = useAppSelector(state => state.tasks.tasks);
  const allUsers = useAppSelector(state => state.users.users);
  const projects = useAppSelector(state => state.projects.projects);
  const organizationLoaded = plants.length > 0 || departments.length > 0;

  const editProject = useMemo(() => projects.find(p => p.id === editProjectId), [projects, editProjectId]);

  const [currentStep, setCurrentStep] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [isEditLoaded, setIsEditLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCftPickerOpen, setIsCftPickerOpen] = useState(false);
  const [selectedCftMemberIds, setSelectedCftMemberIds] = useState<string[]>([]);

  const [projectData, setProjectData] = useState({
    plantId: '',
    customer: '',
    name: '',
    rfqNo: '',
    apqpNo: '',
    vehicleModel: '',
    partCode: '',
    sopDate: '',
    sopVolume: '',
    startDate: '',
    endDate: '',
    projectLeadId: '',
    projectLead: '',
    departmentId: '',
    status: 'Active',
    description: ''
  });

  const [drs, setDrs] = useState<ProjectDR[]>([
    { id: '1', number: '', status: 'Open' }
  ]);


  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  const accessiblePlantIds = useMemo(() => getAccessiblePlantIds(user, plants), [plants, user]);
  const accessiblePlants = useMemo(
    () => plants.filter((plant) => accessiblePlantIds.includes(plant.id)),
    [accessiblePlantIds, plants],
  );
  const userDepartmentNames = Array.isArray(user.department) ? user.department : [user.department];

  React.useEffect(() => {
    if (!organizationLoaded) {
      dispatch(fetchOrganizationData());
    }
    if (taskTemplates.length === 0) {
      dispatch(fetchTaskTemplates());
    }
    if (allUsers.length === 0) {
      dispatch(fetchUsers(accessiblePlantIds.length > 0 ? { plantIds: accessiblePlantIds } : undefined));
    }
  }, [accessiblePlantIds, allUsers.length, dispatch, organizationLoaded, taskTemplates.length]);

  React.useEffect(() => {
    if (editProject && !isEditLoaded && plants.length > 0 && departments.length > 0) {
      setProjectData({
        plantId: editProject.plantId,
        customer: editProject.customer,
        name: editProject.name,
        rfqNo: editProject.rfqNo || '',
        apqpNo: editProject.apqpNo || '',
        vehicleModel: editProject.vehicleModel || '',
        partCode: editProject.partCode,
        sopDate: editProject.sopDate,
        sopVolume: editProject.sopVolume || '',
        startDate: editProject.startDate || '',
        endDate: editProject.endDate || '',
        projectLeadId: editProject.projectLeadId || '',
        projectLead: editProject.projectLead,
        departmentId: editProject.departmentId || '',
        status: editProject.status || 'Active',
        description: editProject.description || ''
      });
      setSelectedCftMemberIds(editProject.cftMemberIds || []);
      setDrs(editProject.drs || []);
      setSelectedTasks(editProject.selectedTasks || []);
      setIsEditLoaded(true);
    }
  }, [editProject, isEditLoaded, plants, departments]);

  const creatorDepartmentForSelectedPlant = departments.find(department =>
    department.plantId === projectData.plantId &&
    (
      userDepartmentNames.includes(department.name) ||
      user.departmentIds?.includes(department.id)
    )
  );

  React.useEffect(() => {
    if (accessiblePlants.length === 0 || editProject) return;

    setProjectData(prev => {
      const nextPlantId = accessiblePlants.some((plant) => plant.id === prev.plantId)
        ? prev.plantId
        : accessiblePlants[0]?.id || '';
      const nextDepartmentId = creatorDepartmentForSelectedPlant?.id || '';

      if (prev.plantId === nextPlantId && prev.departmentId === nextDepartmentId) {
        return prev;
      }

      return {
        ...prev,
        plantId: nextPlantId,
        departmentId: nextDepartmentId
      };
    });
  }, [accessiblePlants, creatorDepartmentForSelectedPlant, editProject]);

  const changedFields = useMemo(() => {
    if (!editProject) return [];
    const fields = [];
    if (projectData.name !== editProject.name) fields.push('Project Name');
    if (projectData.customer !== editProject.customer) fields.push('Customer');
    if (projectData.vehicleModel !== editProject.vehicleModel) fields.push('Vehicle Model');
    if (projectData.partCode !== editProject.partCode) fields.push('Part Code');
    if (projectData.sopDate !== editProject.sopDate) fields.push('SOP Date');
    if (projectData.sopVolume !== editProject.sopVolume) fields.push('SOP Volume');
    if (projectData.startDate !== editProject.startDate) fields.push('Start Date');
    if (projectData.endDate !== editProject.endDate) fields.push('End Date');
    if (projectData.rfqNo !== editProject.rfqNo) fields.push('RFQ No');
    if (projectData.apqpNo !== editProject.apqpNo) fields.push('APQP No');
    if (projectData.description !== editProject.description) fields.push('Description');
    if (projectData.plantId !== editProject.plantId) fields.push('Plant');
    if (projectData.departmentId !== editProject.departmentId) fields.push('Department');
    if (projectData.projectLeadId !== editProject.projectLeadId) fields.push('Project Lead');

    // Check arrays roughly
    if (selectedTasks.length !== (editProject.selectedTasks?.length || 0)) fields.push('APQP Scope Tasks');
    if (drs.length !== (editProject.drs?.length || 0)) fields.push('DR & Compliance');
    if (selectedCftMemberIds.length !== (editProject.cftMemberIds?.length || 0)) fields.push('CFT Members');

    return fields;
  }, [projectData, editProject, selectedTasks, drs, selectedCftMemberIds]);

  const plantDepartmentIds = departments
    .filter(department => !projectData.plantId || department.plantId === projectData.plantId)
    .map(department => department.id);

  const projectLeadDepartmentIds = departments
    .filter(department => department.plantId === projectData.plantId && isProjectCreationDepartmentName(department.name))
    .map(department => department.id);

  const plantUsers = projectData.plantId ? filterUsersByPlantAccess(allUsers, projectData.plantId) : [];

  // Project lead options come from active R&D users for the selected plant.
  const filteredProjectLeads = plantUsers.filter(userProfile =>
    userProfile.departmentIds.some(departmentId => projectLeadDepartmentIds.includes(departmentId))
  );

  const [cftSearchQuery, setCftSearchQuery] = useState('');
  const searchTerm = cftSearchQuery.trim().toLowerCase();

  const filteredCftMembers = plantUsers.filter((userProfile) => {
    if (!searchTerm) return true;
    const target = [userProfile.name, userProfile.email, userProfile.role]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return target.includes(searchTerm);
  });

  // APQP scope is cross-functional, so include all department templates for the captured plant.
  const filteredTasks = taskTemplates.filter(task =>
    plantDepartmentIds.length === 0 || plantDepartmentIds.includes(task.departmentId)
  );
  const selectedLead = filteredProjectLeads.find(lead => lead.id === projectData.projectLeadId);
  const selectedPlant = plants.find(plant => plant.id === projectData.plantId);
  const selectedCftMembers = plantUsers.filter(candidate => selectedCftMemberIds.includes(candidate.id));
  const projectNotificationRecipients = plantUsers.filter((candidate) =>
    candidate.status === 'Active' && PROJECT_NOTIFICATION_ROLE_KEYS.has(normalizeRoleKey(candidate.role))
  );

  // Group filtered tasks by phase
  const tasksByPhase = filteredTasks.reduce((acc, task) => {
    if (!acc[task.phase]) acc[task.phase] = [];
    acc[task.phase].push(task);
    return acc;
  }, {} as Record<string, typeof taskTemplates>);



  const handleInputChange = (field: string, value: string) => {
    setProjectData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number) => {
    if (step === 0) {
      // Required field validation (matches backend: customer, name, plantId, partCode, sopDate, projectLead)
      if (!projectData.plantId) {
        toast.error('Please select a Project Plant');
        return false;
      }
      if (!projectData.customer.trim()) {
        toast.error('Customer name is required');
        return false;
      }
      if (!projectData.name.trim()) {
        toast.error('Project Name is required');
        return false;
      }
      if (!projectData.partCode.trim()) {
        toast.error('Part Code is required');
        return false;
      }
      if (!projectData.sopDate) {
        toast.error('SOP Date is required');
        return false;
      }
      if (!projectData.projectLead.trim()) {
        toast.error('Project Lead is required');
        return false;
      }
      // Date logic check
      if (projectData.startDate && projectData.endDate && new Date(projectData.startDate) > new Date(projectData.endDate)) {
        toast.error('End Date cannot be before Start Date');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = () => {
    setIsConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    // Final safety guard — mirrors backend required fields
    const missing: string[] = [];
    if (!projectData.customer.trim()) missing.push('Customer');
    if (!projectData.name.trim()) missing.push('Project Name');
    if (!projectData.plantId) missing.push('Plant');
    if (!projectData.partCode.trim()) missing.push('Part Code');
    if (!projectData.sopDate) missing.push('SOP Date');
    if (!projectData.projectLead.trim()) missing.push('Project Lead');
    if (missing.length > 0) {
      toast.error(`Missing required fields: ${missing.join(', ')}`);
      setIsConfirmOpen(false);
      setCurrentStep(0);
      return;
    }

    const selectedTaskTemplates = filteredTasks.filter(task => selectedTasks.includes(task.id));
    const workflowTasks = createWorkflowTasks({
      selectedTaskTemplates,
      departments,
      users: allUsers,
      plantId: projectData.plantId,
      fallbackAssigneeId: selectedLead?.id,
      fallbackAssigneeName: selectedLead?.name || projectData.projectLead,
      planDate: projectData.startDate || projectData.sopDate,
      cftMemberIds: selectedCftMemberIds,
    });
    const workflowSummary = summarizeProjectWorkflow(workflowTasks);
    const creationTimestamp = new Date().toISOString();
    const projectFiles = drs
      .filter((dr) => dr.fileUrl)
      .map((dr) => ({
        id: `dr-file-${dr.id}`,
        name: dr.fileName || `${dr.number || 'DR'} Attachment`,
        url: dr.fileUrl as string,
        taskId: dr.id,
        taskName: `Development Request${dr.number ? ` - ${dr.number}` : ''}`,
        phase: 'Project Creation',
        department: 'Project',
        uploadedBy: user.name,
        uploadedAt: dr.uploadedAt || creationTimestamp,
        source: 'development-request' as const,
        fileType: dr.fileType,
        fileSize: dr.fileSize,
      }));

    const finalProjectData: Omit<Project, 'id'> = {
      plantId: projectData.plantId,
      customer: projectData.customer,
      name: projectData.name,
      rfqNo: projectData.rfqNo,
      apqpNo: projectData.apqpNo,
      vehicleModel: projectData.vehicleModel,
      partCode: projectData.partCode,
      sopDate: projectData.sopDate,
      sopVolume: projectData.sopVolume,
      startDate: projectData.startDate,
      endDate: projectData.endDate,
      projectLeadId: projectData.projectLeadId,
      projectLead: projectData.projectLead,
      departmentId: projectData.departmentId,
      cftMemberIds: selectedCftMemberIds,
      cftMembers: selectedCftMembers.map((member) => member.name),
      status: workflowSummary.status,
      description: projectData.description,
      selectedTasks: selectedTasks,
      drs: drs,
      workflowTasks,
      projectFiles,
      notifiedUserIds: projectNotificationRecipients.map(candidate => candidate.id),
      notificationChannels: ['in-app', 'email'],
      phase: workflowSummary.phase,
      progress: workflowSummary.progress,
      createdById: editProject ? editProject.createdById : user.id,
      createdByName: editProject ? editProject.createdByName : user.name,
      pendingApprovalRequest: null,
    };

    setIsSaving(true);
    try {
      if (editProject) {
        // Dispatch edit request
        await dispatch(requestProjectUpdate({
          id: editProject.id,
          changes: finalProjectData,
          reason: editReason
        })).unwrap();
        toast.success(`Project update request submitted successfully for approval.`);
        setIsConfirmOpen(false);
        onNavigate('projects');
      } else {
        const createdProject = await dispatch(createProject(finalProjectData)).unwrap();
        dispatch(addNotifications(
          projectNotificationRecipients.map(candidate => ({
            id: `notification-${createdProject.id}-${candidate.id}`,
            userId: candidate.id,
            title: 'Project Created Successfully',
            message: `${createdProject.name} is now active for ${selectedPlant?.name || 'the selected plant'} under ${projectData.projectLead || 'the assigned project lead'}.`,
            type: 'project',
            createdAt: new Date().toISOString(),
            read: false,
            channel: 'in-app',
            projectId: createdProject.id,
            plantId: projectData.plantId,
          }))
        ));

        toast.success(`Project created successfully with APQP workflow initialized. ${projectNotificationRecipients.length} plant managers notified.`);
        setIsConfirmOpen(false);
        onNavigate('projects');
      }
    } catch (error: any) {
      toast.error(error || 'Failed to create project');
    } finally {
      setIsSaving(false);
    }
  };


  // DR Handlers
  const addDR = () => setDrs(prev => [...prev, { id: Date.now().toString(), number: '', status: 'Open' }]);

  const removeDR = (id: string) => setDrs(prev => prev.filter(dr => dr.id !== id));
  const updateDR = (id: string, field: string, value: any) => setDrs(prev => prev.map(dr => dr.id === id ? { ...dr, [field]: value } : dr));
  const handleDrFileChange = async (id: string, file?: File | null) => {
    if (!file) {
      updateDR(id, 'fileUrl', undefined);
      updateDR(id, 'fileName', undefined);
      updateDR(id, 'fileType', undefined);
      updateDR(id, 'fileSize', undefined);
      updateDR(id, 'uploadedAt', undefined);
      return;
    }

    try {
      const fileUrl = await readFileAsDataUrl(file);
      setDrs((prev) => prev.map((dr) => dr.id === id ? {
        ...dr,
        fileUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      } : dr));
    } catch (error) {
      toast.error('Failed to attach the selected DR file.');
    }
  };

  // Task Handlers
  const handleTaskToggle = (taskId: string) => {
    setSelectedTasks(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };
  const handleSelectAllPhase = (phase: string) => {
    const phaseTasksIds = tasksByPhase[phase].map(t => t.id);
    const allSelected = phaseTasksIds.every(id => selectedTasks.includes(id));
    setSelectedTasks(prev => allSelected ? prev.filter(id => !phaseTasksIds.includes(id)) : [...new Set([...prev, ...phaseTasksIds])]);
  };
  const handleCftMemberToggle = (memberId: string) => {
    setSelectedCftMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };


  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 4;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [cftSearchQuery]);

  const paginatedMembers = filteredCftMembers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalPages = Math.max(1, Math.ceil(filteredCftMembers.length / ITEMS_PER_PAGE));

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <Layout user={user} currentPage="project-create" onNavigate={onNavigate} onLogout={onLogout} title="New Project Initiation">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Progress Stepper */}
        <div className="flex items-center justify-between px-10 py-4 bg-white rounded-xl shadow-sm border">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                index < currentStep ? "bg-green-100 text-green-700 border border-green-200" :
                  index === currentStep ? "bg-[#ed1c24] text-white" :
                    "bg-slate-100 text-slate-400 border border-slate-200"
              )}>
                {index < currentStep ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
              </div>
              <span className={cn(
                "text-sm font-medium",
                index === currentStep ? "text-slate-900" : "text-slate-500"
              )}>{step}</span>
              {index < steps.length - 1 && (
                <div className="w-12 h-px bg-slate-200 mx-4 hidden md:block" />
              )}
            </div>
          ))}
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-slate-50 border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">
                  {steps[currentStep]}
                </CardTitle>
                <CardDescription>
                  {currentStep === 0 && "Enter core project metadata and definitions."}
                  {currentStep === 1 && "Attach Design Reviews (DR) and compliance documents."}
                  {currentStep === 2 && "Select cross-functional APQP tasks applicable for this project."}
                  {currentStep === 3 && "Review all details before final submission."}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <ScrollArea className="h-[calc(100vh-380px)] pr-4">

              {/* Step 1: Project Details */}
              {currentStep === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2" hidden>
                    <Label htmlFor="plantId" className="text-slate-700">Project Plant</Label>
                    <Select
                      value={projectData.plantId}
                      onValueChange={(value) => {
                        handleInputChange('plantId', value);
                        handleInputChange('projectLeadId', '');
                        handleInputChange('projectLead', '');
                        setSelectedCftMemberIds([]);
                      }}
                      disabled={accessiblePlants.length <= 1}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select plant" />
                      </SelectTrigger>
                      <SelectContent>
                        {accessiblePlants.map((plant) => (
                          <SelectItem key={plant.id} value={plant.id}>
                            {plant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Project creation, workflow execution, and closure stay scoped to the selected plant.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer" className="text-slate-700">Customer</Label>
                    <Input
                      id="customer"
                      value={projectData.customer}
                      onChange={(e) => handleInputChange('customer', e.target.value)}
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectName" className="text-slate-700">Project Name</Label>
                    <Input id="name" value={projectData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="e.g. Gear Assembly Gen-2" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rfqNo" className="text-slate-700">RFQ No.</Label>
                    <Input id="rfqNo" value={projectData.rfqNo} onChange={(e) => handleInputChange('rfqNo', e.target.value)} placeholder="RFQ-2024-XXX" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apqpNo" className="text-slate-700">APQP Ref No.</Label>
                    <Input id="apqpNo" value={projectData.apqpNo} onChange={(e) => handleInputChange('apqpNo', e.target.value)} placeholder="APQP-2024-XXX" />
                  </div>


                  <div className="space-y-2">
                    <Label htmlFor="vehicle" className="text-slate-700">Vehicle / Model</Label>
                    <Input id="vehicleModel" value={projectData.vehicleModel} onChange={(e) => handleInputChange('vehicleModel', e.target.value)} placeholder="e.g. Nexon EV" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="partCode" className="text-slate-700">Part Code</Label>
                    <Input id="partCode" value={projectData.partCode} onChange={(e) => handleInputChange('partCode', e.target.value)} placeholder="e.g. GA-2024-001" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sopDate" className="text-slate-700">SOP Date</Label>
                    <Input id="sopDate" type="date" value={projectData.sopDate} onChange={(e) => handleInputChange('sopDate', e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sopVolume" className="text-slate-700">SOP Volume (per annum)</Label>
                    <Input id="sopVolume" type="number" value={projectData.sopVolume} onChange={(e) => handleInputChange('sopVolume', e.target.value)} placeholder="e.g. 50000" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectLead" className="text-slate-700">Project Lead</Label>
                    <Select
                      value={projectData.projectLeadId}
                      onValueChange={(v) => {
                        const lead = filteredCftMembers.find(candidate => candidate.id === v);
                        handleInputChange('projectLeadId', v);
                        handleInputChange('projectLead', lead?.name || '');
                      }}
                      disabled={!projectData.plantId}
                    >
                      <SelectTrigger><SelectValue placeholder="Select Project Lead" /></SelectTrigger>
                      <SelectContent>
                        {filteredCftMembers.map(l => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                        {/*  ({l.role}) */}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Dropdown includes active R&amp;D users available for the selected plant.</p>
                  </div>

                  {/* <div className="space-y-2 md:col-span-2 lg:col-span-3">
                    <Label className="text-slate-700">CFT Members</Label>
                    <Popover open={isCftPickerOpen} onOpenChange={setIsCftPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between font-normal"
                          disabled={!projectData.plantId}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Users className="h-4 w-4 text-slate-500" />
                            {selectedCftMembers.length > 0
                              ? `${selectedCftMembers.length} member${selectedCftMembers.length > 1 ? 's' : ''} selected`
                              : 'Select members'}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[420px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search members..." />
                          <CommandList>
                            <CommandEmpty>No members found.</CommandEmpty>
                            <CommandGroup>
                              {filteredCftMembers.map((member) => (
                                <CommandItem
                                  key={member.id}
                                  value={`${member.name} ${member.email} ${member.role}`}
                                  onSelect={() => handleCftMemberToggle(member.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedCftMemberIds.includes(member.id) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate">{member.name}</span>
                                    <span className="text-xs text-slate-500 truncate">{member.email} • {member.role}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedCftMembers.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedCftMembers.map((member) => (
                          <Badge key={member.id} variant="secondary" className="bg-slate-100 text-slate-700">
                            {member.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div> */}



                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-slate-700">Start Date</Label>
                    <Input id="startDate" type="date" value={projectData.startDate} onChange={(e) => handleInputChange('startDate', e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="text-slate-700">End Date</Label>
                    <Input id="endDate" type="date" value={projectData.endDate} onChange={(e) => handleInputChange('endDate', e.target.value)} />
                  </div>

                  <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-2">
                    <Label htmlFor="description" className="text-slate-700">Project Description / Scope</Label>
                    <Textarea id="description" value={projectData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Enter detailed project scope..." rows={3} />
                  </div>



                  <div className="space-y-2 md:col-span-2 lg:col-span-3">
                    <Label className="text-slate-700 font-medium">CFT Members</Label>

                    <div className="border rounded-xl bg-slate-50/50 p-3 space-y-3">
                      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                        <div className="px-3 py-2 border-b">
                          <Input
                            value={cftSearchQuery}
                            onChange={(e) => setCftSearchQuery(e.target.value)}
                            placeholder="Search team members by name, email, or role..."
                            className="h-10"
                          />
                        </div>

                        <div className="h-[240px] max-h-[240px] overflow-y-auto border-t divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-slate-200">
                          {paginatedMembers.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-400 italic">No members found.</div>
                          ) : (
                            paginatedMembers.map((member) => {
                              const isSelected = selectedCftMemberIds.includes(member.id);
                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => handleCftMemberToggle(member.id)}
                                  className={cn(
                                    "flex w-full items-center justify-between px-3 py-2.5 my-0.5 rounded-md transition-colors text-sm text-left",
                                    isSelected ? "bg-slate-50 font-medium text-slate-950" : "hover:bg-slate-50/80 text-slate-700"
                                  )}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={cn(
                                      "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                                      isSelected ? "bg-[#ed1c24] border-[#ed1c24] text-white" : "border-slate-300 bg-white"
                                    )}>
                                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>

                                    <div className="flex flex-col min-w-0 leading-tight">
                                      <span className="truncate text-slate-900 font-medium">{member.name}</span>
                                      <span className="text-xs text-slate-500 truncate mt-0.5">
                                        {member.email} • {member.role}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>

                        <div className="flex items-center justify-between px-3 py-2 border-t bg-slate-50">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => p - 1)}
                          >
                            Previous
                          </Button>

                          <span className="text-xs text-slate-500">
                            Members {currentPage} of {totalPages}
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 px-0.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          Selected Group ({selectedCftMembers.length})
                        </div>

                        {selectedCftMembers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 p-2 bg-white border rounded-lg max-h-[90px] overflow-y-auto shadow-inner">
                            {selectedCftMembers.map((member) => (
                              <Badge
                                key={member.id}
                                variant="secondary"
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 pr-1 pl-2 py-0.5 flex items-center gap-1 text-xs font-medium border rounded transition-colors"
                              >
                                <span className="truncate max-w-[140px]">{member.name}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCftMemberToggle(member.id);
                                  }}
                                  className="text-slate-400 hover:text-slate-600 rounded p-0.5 focus:outline-none"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs italic text-slate-400 bg-white border border-dashed rounded-lg p-2.5 text-center">
                            No cross-functional members linked yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: DR Section */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800">Development Request (DR)</h3>
                    <Button onClick={addDR} size="sm" variant="outline" className="border-dashed">
                      <Plus className="w-4 h-4 mr-2" /> Add DR Entry
                    </Button>
                  </div>

                  {drs.map((dr, index) => (
                    <Card key={dr.id} className="bg-slate-50 border-slate-200">
                      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs">DR Number</Label>
                          <Input value={dr.number} onChange={(e) => updateDR(dr.id, 'number', e.target.value)} placeholder={`DR-${index + 1}`} className="bg-white" />
                        </div>
                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs">Status</Label>
                          <Select value={dr.status} onValueChange={(v) => updateDR(dr.id, 'status', v)}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['Open', 'In Progress', 'Closed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-5 space-y-1">
                          <Label className="text-xs">Attachment</Label>
                          <Input
                            type="file"
                            className="bg-white cursor-pointer"
                            onChange={(e) => handleDrFileChange(dr.id, e.target.files?.[0])}
                          />
                          {dr.fileName && (
                            <p className="text-[11px] text-slate-500 mt-1 truncate">
                              Attached: {dr.fileName}
                            </p>
                          )}
                        </div>
                        <div className="md:col-span-1">
                          {drs.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => removeDR(dr.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Step 3: APQP Scope */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  {!projectData.plantId ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-4 border-2 border-dashed rounded-xl">
                      <AlertTriangle className="w-10 h-10 text-amber-500" />
                      <p>Select a plant to load APQP task templates.</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-semibold">APQP Planning - Cross-Functional Department Tasks</p>
                          <p>Select the tasks relevant to this project. Unselected tasks will not appear in the project workflow.</p>
                          <p className="mt-1">Selected tasks will be auto-assigned to department managers for the selected plant.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                        {Object.entries(tasksByPhase).length === 0 ? (
                          <div className="text-center py-10 bg-slate-50 rounded-xl border">
                            <p className="text-slate-500">No APQP task templates found for the available departments.</p>
                            <Button variant="link" onClick={() => onNavigate('tasks')} className="text-[#ed1c24]">
                              Configure Tasks in Template Master
                            </Button>
                          </div>
                        ) : (
                          Object.entries(tasksByPhase).map(([phase, tasks]) => (
                            <Card key={phase} className="border shadow-sm">
                              <CardHeader className="py-3 bg-slate-50 border-b">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-semibold">{phase}</CardTitle>
                                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleSelectAllPhase(phase)}>
                                    {tasks.every(t => selectedTasks.includes(t.id)) ? 'Deselect All' : 'Select All'}
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {tasks.map(task => (
                                    <div key={task.id} className="flex items-start space-x-2 p-2 rounded hover:bg-slate-50 transition-colors">
                                      <Checkbox id={task.id} checked={selectedTasks.includes(task.id)} onCheckedChange={() => handleTaskToggle(task.id)} />
                                      <label htmlFor={task.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer pt-0.5">
                                        {task.name}
                                        <span className="block text-[11px] text-slate-500 font-normal mt-1">
                                          {departments.find(d => d.id === task.departmentId)?.name || 'Department not mapped'}
                                        </span>
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}


              {/* Step 4: Review */}
              {currentStep === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-slate-50 border rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                        Ready for Initiation
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl font-bold text-[#ed1c24] border border-slate-200">
                        {projectData.customer[0]}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{projectData.name}</h3>
                        <p className="text-slate-500">APQP Workflow Initiation for {projectData.customer}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Plant</span>
                        <p className="font-semibold text-slate-700">{plants.find(p => p.id === projectData.plantId)?.name}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Project Lead</span>
                        <p className="font-semibold text-slate-700">{projectData.projectLead}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">CFT Members</span>
                        <p className="font-semibold text-slate-700">{selectedCftMembers.length > 0 ? selectedCftMembers.length : 'Not selected'}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SOP Date</span>
                        <p className="font-semibold text-slate-700">{projectData.sopDate}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Part Code</span>
                        <p className="font-semibold text-slate-700">{projectData.partCode}</p>
                      </div>
                    </div>

                    {selectedCftMembers.length > 0 && (
                      <div className="mt-6 space-y-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Selected CFT Members</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedCftMembers.map((member) => (
                            <Badge key={member.id} variant="secondary" className="bg-white text-slate-700 border border-slate-200">
                              {member.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-[#ed1c24]/10 flex items-center justify-center text-[#ed1c24]">
                          <Save className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900">APQP Scope Summary</h4>
                      </div>
                      <Card className="rounded-xl border-slate-200">
                        <div className="p-4 space-y-4">
                          <div className="flex items-center justify-between py-2 border-b border-slate-100 italic font-medium">
                            <span className="text-sm text-slate-600">Total Tasks Selected</span>
                            <Badge variant="outline" className="text-lg font-bold px-3">{selectedTasks.length}</Badge>
                          </div>
                          <div className="space-y-3">
                            {Object.entries(tasksByPhase).map(([phase, tasks]) => {
                              const phaseSelectedCount = tasks.filter(t => selectedTasks.includes(t.id)).length;
                              if (phaseSelectedCount === 0) return null;
                              return (
                                <div key={phase} className="flex items-center justify-between text-sm">
                                  <span className="text-slate-600 truncate mr-4">{phase}</span>
                                  <span className="font-bold text-slate-900 shrink-0">{phaseSelectedCount} / {tasks.length}</span>
                                </div>
                              );
                            })}
                          </div>
                          <Separator />
                          <div className="text-sm text-slate-600">
                            In-app and email notifications will go to the selected plant's Managers, Deputy Managers, and Assistant Managers, and each selected task will start with plant-level department-manager ownership.
                          </div>
                        </div>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                          <Upload className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900">DR & Compliance</h4>
                      </div>
                      <div className="space-y-3">
                        {drs.map((dr, i) => (
                          <div key={dr.id} className="flex items-center justify-between gap-4 p-3 bg-white border border-slate-200 rounded-xl shadow-sm text-sm">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">{i + 1}</span>
                              <div className="min-w-0">
                                <span className="block font-medium text-slate-700 truncate">{dr.number || `Document #${i + 1}`}</span>
                                <span className="block text-xs text-slate-500 truncate">{dr.fileName || 'No attachment uploaded'}</span>
                              </div>
                            </div>
                            <Badge className={cn(
                              "text-[10px] px-2",
                              dr.status === 'Open' ? "bg-amber-100 text-amber-700" :
                                dr.status === 'Closed' ? "bg-green-100 text-green-700" :
                                  "bg-blue-100 text-blue-700"
                            )}>
                              {dr.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}


            </ScrollArea>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <Button variant="outline" onClick={currentStep === 0 ? onCancel : handleBack}>
                {currentStep === 0 ? 'Cancel' : 'Back'}
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button onClick={handleNext} className="bg-slate-900 hover:bg-slate-800">
                  Next Step <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="bg-[#ed1c24] hover:bg-[#c4171e] min-w-[140px]"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editProject ? 'Review Changes' : 'Create Project'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editProject ? 'Request Project Edit' : 'Confirm Project Creation'}</DialogTitle>
            <DialogDescription>
              {editProject
                ? 'Your changes will be visible to everyone only after manager-level approval.'
                : 'Are you sure you want to create this project? This will initialize the APQP workflow and notify manager-level stakeholders in the selected plant.'}
            </DialogDescription>
          </DialogHeader>

          {editProject && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-semibold text-slate-700">Updated Fields</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {changedFields.length > 0 ? changedFields.map(f => (
                    <Badge key={f} variant="outline" className="bg-slate-50">{f}</Badge>
                  )) : (
                    <span className="text-sm text-slate-500">No fields changed.</span>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold text-slate-700">Reason for Edit Request</Label>
                <Textarea
                  placeholder="Explain why these changes are necessary..."
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={confirmSubmit}
              className="bg-[#ed1c24]"
              disabled={isSaving || (!!editProject && !editReason.trim() && changedFields.length > 0)}
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {editProject ? 'Submitting...' : 'Creating...'}</>
              ) : (
                editProject ? 'Submit for Approval' : 'Confirm & Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
