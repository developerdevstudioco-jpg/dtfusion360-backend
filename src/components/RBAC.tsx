import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Search,
  Shield,
  Users,
  Workflow,
  XCircle,
  Edit2,
  Save,
  X,
  Loader,
} from 'lucide-react';
import { Page, User, UserProfile } from '../types';
import Layout from './Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchOrganizationData } from '../features/organization/organizationSlice';
import { fetchUsers } from '../features/users/userSlice';
import { setPermissions, updatePermission, RBACPermission } from '../features/rbac/rbacSlice';
import { cn } from './ui/utils';
import { rbacApi } from '../api/rbacApi';
import { BRAND_COLORS } from '../utils/branding';
import {
  ACCESS_MATRIX_PAGES,
  ALL_ASSIGNABLE_ROLES,
  AccessState,
  canAccessPage,
  getDepartmentPageAccessReason,
  getDepartmentPageAccessState,
  getRolePageAccessReason,
  getRolePageAccessState,
  isPlantAdminRole,
  isSuperAdminRole,
} from '../utils/rbac';

interface RBACProps {
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

type AccessBadgeProps = {
  state: AccessState;
  conditionalLabel: string;
  title: string;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value];
  }

  return [];
};

const resolvePlantAssignments = (assignments: unknown, plantOptions: { id: string; name: string }[]) => {
  return normalizeStringArray(assignments).map((assignment) => {
    const matchedPlant = plantOptions.find((plant) => plant.id === assignment || plant.name === assignment);
    return matchedPlant?.id ?? assignment;
  });
};

const getUserPlantIds = (currentUser: User, plantOptions: { id: string; name: string }[]) => {
  return resolvePlantAssignments(currentUser.plantIds ?? currentUser.plant, plantOptions);
};

const getRecordPlantIds = (
  record: { plantIds?: string[]; plant?: string | string[] },
  plantOptions: { id: string; name: string }[]
) => resolvePlantAssignments(record.plantIds ?? record.plant, plantOptions);

const getUserDepartmentNames = (
  scopedUser: UserProfile,
  departmentOptions: { id: string; name: string }[]
) => normalizeStringArray(scopedUser.departmentIds).map((departmentId) => {
  const department = departmentOptions.find((option) => option.id === departmentId);
  return department?.name ?? departmentId;
});

const getUserPlantNames = (
  scopedUser: UserProfile,
  plantOptions: { id: string; name: string }[]
) => normalizeStringArray(scopedUser.plantIds).map((plantId) => {
  const plant = plantOptions.find((option) => option.id === plantId);
  return plant?.name ?? plantId;
});

function AccessBadge({ state, conditionalLabel, title }: AccessBadgeProps) {
  if (state === 'allowed') {
    return (
      <Badge
        title={title}
        className="justify-center gap-1 rounded-md border-green-200 bg-green-50 text-green-700 hover:bg-green-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Allow
      </Badge>
    );
  }

  if (state === 'blocked') {
    return (
      <Badge
        title={title}
        variant="secondary"
        className="justify-center gap-1 rounded-md border-red-200 bg-red-50 text-red-700 hover:bg-red-50"
      >
        <XCircle className="h-3.5 w-3.5" />
        Block
      </Badge>
    );
  }

  return (
    <Badge
      title={title}
      variant="outline"
      className="justify-center gap-1 rounded-md border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
    >
      <AlertCircle className="h-3.5 w-3.5" />
      {conditionalLabel}
    </Badge>
  );
}

interface EditableAccessBadgeProps {
  state: AccessState;
  conditionalLabel: string;
  title: string;
  isEditable?: boolean;
  isLoading?: boolean;
  onToggle?: (newState: 'allowed' | 'blocked') => void;
}

function EditableAccessBadge({
  state,
  conditionalLabel,
  title,
  isEditable = false,
  isLoading = false,
  onToggle,
}: EditableAccessBadgeProps) {
  if (!isEditable) {
    return <AccessBadge state={state} conditionalLabel={conditionalLabel} title={title} />;
  }

  const currentAccess = state === 'allowed' ? 'allowed' : 'blocked';
  const newAccess = currentAccess === 'allowed' ? 'blocked' : 'allowed';

  return (
    <button
      onClick={() => {
        if (!isLoading && onToggle) {
          onToggle(newAccess as 'allowed' | 'blocked');
        }
      }}
      disabled={isLoading}
      className="w-full cursor-pointer"
      title={title}
    >
      {isLoading ? (
        <Badge variant="outline" className="justify-center gap-1 rounded-md border-slate-200 bg-slate-50">
          <Loader className="h-3.5 w-3.5 animate-spin" />
        </Badge>
      ) : currentAccess === 'allowed' ? (
        <Badge
          className="justify-center gap-1 rounded-md border-green-200 bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Allow
        </Badge>
      ) : (
        <Badge
          variant="secondary"
          className="justify-center gap-1 rounded-md border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
        >
          <XCircle className="h-3.5 w-3.5" />
          Block
        </Badge>
      )}
    </button>
  );
}

export default function RBAC({ user: propUser, onNavigate, onLogout }: RBACProps) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);

  const user = useMemo(() => authUser || propUser, [authUser, propUser]);

  const plants = useAppSelector((state) => state.organization.plants);
  const departments = useAppSelector((state) => state.organization.departments);
  const users = useAppSelector((state) => state.users.users);

  const [activeTab, setActiveTab] = useState('roles');
  const [selectedPlantId, setSelectedPlantId] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingCells, setLoadingCells] = useState<Set<string>>(new Set());
  const dbPermissions = useAppSelector((state) => state.rbac.permissions);

  const canEditRBAC = isSuperAdminRole(user.role) || isPlantAdminRole(user.role);

  const isSuperAdmin = isSuperAdminRole(user.role);
  const plantAdminPlantIds = useMemo(() => getUserPlantIds(user, plants), [user, plants]);
  const scopePlantIds = useMemo(() => {
    if (isPlantAdminRole(user.role)) {
      return plantAdminPlantIds;
    }

    if (selectedPlantId !== 'all') {
      return [selectedPlantId];
    }

    return plants.map((plant) => plant.id);
  }, [plantAdminPlantIds, plants, selectedPlantId, user.role]);

  useEffect(() => {
    if (plants.length === 0 || departments.length === 0) {
      dispatch(fetchOrganizationData());
    }
  }, [departments.length, dispatch, plants.length]);

  useEffect(() => {
    dispatch(fetchUsers(isPlantAdminRole(user.role) ? { plantIds: plantAdminPlantIds } : undefined));
  }, [dispatch, plantAdminPlantIds, user.role]);

  useEffect(() => {
    if (!isSuperAdmin && selectedPlantId !== 'all') {
      setSelectedPlantId('all');
    }
  }, [isSuperAdmin, selectedPlantId]);

  useEffect(() => {
    if (isEditMode && canEditRBAC) {
      rbacApi.getAllPermissions().then((perms) => {
        if (perms && perms.length > 0) {
          dispatch(setPermissions(perms));
        }
      });
    }
  }, [isEditMode, canEditRBAC, dispatch]);

  const scopedPlants = useMemo(() => {
    if (isPlantAdminRole(user.role)) {
      return plants.filter((plant) => plantAdminPlantIds.includes(plant.id));
    }

    if (selectedPlantId === 'all') {
      return plants;
    }

    return plants.filter((plant) => plant.id === selectedPlantId);
  }, [plantAdminPlantIds, plants, selectedPlantId, user.role]);

  const scopedDepartments = useMemo(() => {
    if (scopePlantIds.length === 0) {
      return departments;
    }

    return departments.filter((department) => scopePlantIds.includes(department.plantId));
  }, [departments, scopePlantIds]);

  const scopedUsers = useMemo(() => {
    const baseUsers = users.filter((candidate) => {
      const recordPlantIds = getRecordPlantIds(candidate as UserProfile & { plant?: string | string[] }, plants);

      if (scopePlantIds.length === 0) {
        return true;
      }

      return recordPlantIds.some((plantId) => scopePlantIds.includes(plantId));
    });

    return baseUsers.filter((candidate) => {
      const matchesRole = selectedRole === 'all' || candidate.role === selectedRole;
      const matchesDepartment = selectedDepartmentId === 'all' || normalizeStringArray(candidate.departmentIds).includes(selectedDepartmentId);
      const matchesSearch = searchTerm.trim().length === 0
        || candidate.name.toLowerCase().includes(searchTerm.toLowerCase())
        || candidate.email.toLowerCase().includes(searchTerm.toLowerCase())
        || candidate.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesRole && matchesDepartment && matchesSearch;
    });
  }, [plants, scopePlantIds, searchTerm, selectedDepartmentId, selectedRole, users]);

  const roleCounts = useMemo(() => {
    return users.reduce<Record<string, number>>((counts, scopedUser) => {
      const recordPlantIds = getRecordPlantIds(scopedUser as UserProfile & { plant?: string | string[] }, plants);
      const inScope = scopePlantIds.length === 0 || recordPlantIds.some((plantId) => scopePlantIds.includes(plantId));

      if (!inScope) {
        return counts;
      }

      counts[scopedUser.role] = (counts[scopedUser.role] ?? 0) + 1;
      return counts;
    }, {});
  }, [plants, scopePlantIds, users]);

  const departmentCounts = useMemo(() => {
    return users.reduce<Record<string, number>>((counts, scopedUser) => {
      const recordPlantIds = getRecordPlantIds(scopedUser as UserProfile & { plant?: string | string[] }, plants);
      const inScope = scopePlantIds.length === 0 || recordPlantIds.some((plantId) => scopePlantIds.includes(plantId));

      if (!inScope) {
        return counts;
      }

      normalizeStringArray(scopedUser.departmentIds).forEach((departmentId) => {
        counts[departmentId] = (counts[departmentId] ?? 0) + 1;
      });

      return counts;
    }, {});
  }, [plants, scopePlantIds, users]);

  const visibleRoles = useMemo(() => {
    return ALL_ASSIGNABLE_ROLES.filter((role) => (roleCounts[role] ?? 0) > 0 || isSuperAdmin || role === user.role);
  }, [isSuperAdmin, roleCounts, user.role]);

  const filteredVisibleRoles = useMemo(() => {
    if (selectedRole === 'all') {
      return visibleRoles;
    }

    return visibleRoles.filter((role) => role === selectedRole);
  }, [selectedRole, visibleRoles]);

  const filteredScopedDepartments = useMemo(() => {
    if (selectedDepartmentId === 'all') {
      return scopedDepartments;
    }

    return scopedDepartments.filter((department) => department.id === selectedDepartmentId);
  }, [scopedDepartments, selectedDepartmentId]);

  const scopeLabel = useMemo(() => {
    if (isPlantAdminRole(user.role)) {
      return scopedPlants.length > 0 ? scopedPlants.map((plant) => plant.name).join(', ') : 'Assigned plant scope';
    }

    if (selectedPlantId === 'all') {
      return 'All plants';
    }

    return scopedPlants[0]?.name ?? 'Selected plant';
  }, [scopedPlants, selectedPlantId, user.role]);

  const getDbPermission = (type: 'role' | 'department', name: string, page: string) => {
    return dbPermissions.find((p) => p.type === type && p.name === name && p.page === page);
  };

  const handleRolePermissionChange = async (role: string, page: string, newAccess: 'allowed' | 'blocked') => {
    const cellKey = `role-${role}-${page}`;
    setLoadingCells((prev) => new Set([...prev, cellKey]));

    // Store level update via Redux
    const permission: RBACPermission = {
      id: `role-${role}-${page}`,
      type: 'role',
      name: role,
      page,
      access: newAccess
    };

    dispatch(updatePermission(permission));

    try {
      await rbacApi.updateRolePermission(role, page, newAccess);
    } catch (error) {
      console.warn('Backend update failed, persisting in store level:', error);
    } finally {
      setLoadingCells((prev) => {
        const newSet = new Set(prev);
        newSet.delete(cellKey);
        return newSet;
      });
    }
  };

  const handleDepartmentPermissionChange = async (department: string, page: string, newAccess: 'allowed' | 'blocked') => {
    const cellKey = `dept-${department}-${page}`;
    setLoadingCells((prev) => new Set([...prev, cellKey]));

    // Store level update via Redux
    const permission: RBACPermission = {
      id: `dept-${department}-${page}`,
      type: 'department',
      name: department,
      page,
      access: newAccess
    };

    dispatch(updatePermission(permission));

    try {
      await rbacApi.updateDepartmentPermission(department, page, newAccess);
    } catch (error) {
      console.warn('Backend update failed, persisting in store level:', error);
    } finally {
      setLoadingCells((prev) => {
        const newSet = new Set(prev);
        newSet.delete(cellKey);
        return newSet;
      });
    }
  };

  return (
    <Layout user={user} currentPage="rbac" onNavigate={onNavigate} onLogout={onLogout} title="Access Matrix">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Left: Title & Description */}
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2 w-fit rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: BRAND_COLORS.primaryLight, backgroundColor: BRAND_COLORS.primaryLighter, color: BRAND_COLORS.primary }}>
                <Shield className="h-3.5 w-3.5" />
                {isEditMode ? 'Edit Mode Active' : 'Live Access Matrix'}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Page Permission Matrix</h1>
                <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                  Manage role and department access to pages. Super Admin views all, Plant Admin views assigned plants only.
                </p>
              </div>
            </div>

            {/* Right: Stats & Action Button */}
            <div className="space-y-4 lg:w-80">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Users In Scope</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{scopedUsers.length}</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Roles</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {Object.values(roleCounts).filter((count) => count > 0).length}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Departments</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{scopedDepartments.length}</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scope</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1 truncate">{scopeLabel}</p>
                </div>
              </div>

              {/* Edit Button */}
              {canEditRBAC && (
                <div className="flex items-center gap-2">
                  {isEditMode && (
                    <button
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          await rbacApi.bulkUpdatePermissions(dbPermissions);
                          setIsEditMode(false);
                        } catch (error) {
                          console.error('Failed to save to backend:', error);
                          setIsEditMode(false);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      disabled={isSaving}
                      className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-110 shadow-lg disabled:opacity-50 border border-emerald-700"
                      style={{ backgroundColor: '#059669', color: '#ffffff' }}
                    >
                      {isSaving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span className="text-white">Save Changes</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsEditMode(!isEditMode);
                      if (isEditMode) setLoadingCells(new Set());
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all shadow-sm",
                      isEditMode
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        : "text-white hover:opacity-90"
                    )}
                    style={!isEditMode ? { backgroundColor: BRAND_COLORS.primary } : {}}
                  >
                    {isEditMode ? (
                      <>
                        <X className="h-4 w-4" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Edit2 className="h-4 w-4" />
                        Edit Matrix
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Refine by plant, role, department, or search users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Plant Filter */}
              {isSuperAdmin ? (
                <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select plant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plants</SelectItem>
                    {plants.map((plant) => (
                      <SelectItem key={plant.id} value={plant.id}>
                        {plant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  {scopeLabel}
                </div>
              )}

              {/* Role Filter */}
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {visibleRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Department Filter */}
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {scopedDepartments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search user..."
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 rounded-lg bg-slate-100 p-1">
            <TabsTrigger value="roles" className="rounded-md py-2">Role Access</TabsTrigger>
            <TabsTrigger value="departments" className="rounded-md py-2">Department Access</TabsTrigger>
            <TabsTrigger value="users" className="rounded-md py-2">User Permissions</TabsTrigger>
          </TabsList>

          {/* Role Wise Tab */}
          <TabsContent value="roles" className="mt-0">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Role-based Page Access</CardTitle>
                <CardDescription>Green = Allowed, Red = Blocked, Amber = Conditional (depends on department)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="min-w-[200px]">Role</TableHead>
                        <TableHead className="min-w-[80px] text-center">Users</TableHead>
                        {ACCESS_MATRIX_PAGES.map((page) => (
                          <TableHead key={page.page} className="min-w-[120px] text-center">
                            <div className="space-y-0.5">
                              <div className="text-xs font-semibold">{page.label}</div>
                              <div className="text-[10px] font-normal text-slate-400">{page.category}</div>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVisibleRoles.map((role) => (
                        <TableRow key={role} className="hover:bg-slate-50/50">
                          <TableCell className="font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              {role}
                              {role === user.role && (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">You</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-sm font-semibold">{roleCounts[role] ?? 0}</TableCell>
                          {ACCESS_MATRIX_PAGES.map((page) => {
                            const state = canAccessPage(role, page.page, dbPermissions) ? 'allowed' : 'blocked';
                            const reason = getRolePageAccessReason(role, page.page);
                            const dbPerm = getDbPermission('role', role, page.page);
                            const dbState = (dbPerm?.access || (getRolePageAccessState(role, page.page) === 'allowed' ? 'allowed' : 'blocked')) as AccessState;
                            const cellKey = `role-${role}-${page.page}`;
                            const isLoading = loadingCells.has(cellKey);

                            return (
                              <TableCell key={page.page} className="text-center">
                                <EditableAccessBadge
                                  state={isEditMode ? dbState : state}
                                  conditionalLabel="Dept"
                                  title={reason}
                                  isEditable={isEditMode}
                                  isLoading={isLoading}
                                  onToggle={(newAccess) => handleRolePermissionChange(role, page.page, newAccess)}
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Department Wise Tab */}
          <TabsContent value="departments" className="mt-0">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Department-based Page Access</CardTitle>
                <CardDescription>Control department-specific pages like Projects, Tasks, and Calibration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="min-w-[240px]">Department</TableHead>
                        <TableHead className="min-w-[80px] text-center">Users</TableHead>
                        {ACCESS_MATRIX_PAGES.map((page) => (
                          <TableHead key={page.page} className="min-w-[120px] text-center">
                            <div className="space-y-0.5">
                              <div className="text-xs font-semibold">{page.label}</div>
                              <div className="text-[10px] font-normal text-slate-400">{page.category}</div>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScopedDepartments.map((dept) => {
                        const plantName = plants.find((p) => p.id === dept.plantId)?.name || 'Unknown';
                        return (
                          <TableRow key={dept.id} className="hover:bg-slate-50/50">
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="font-semibold text-slate-900">{dept.name}</div>
                                <div className="text-xs text-slate-500">{plantName}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm font-semibold">{departmentCounts[dept.id] ?? 0}</TableCell>
                            {ACCESS_MATRIX_PAGES.map((page) => {
                              const state = canAccessPage({ role: user.role, department: dept.name }, page.page, dbPermissions) ? 'allowed' : 'blocked';
                              const reason = getDepartmentPageAccessReason(dept.name, page.page);
                              const dbPerm = getDbPermission('department', dept.name, page.page);
                              const baseState = getDepartmentPageAccessState(dept.name, page.page);
                              const dbState = (dbPerm?.access || (baseState === 'allowed' ? 'allowed' : 'blocked')) as AccessState;
                              const cellKey = `dept-${dept.id}-${page.page}`;
                              const isLoading = loadingCells.has(cellKey);

                              return (
                                <TableCell key={page.page} className="text-center">
                                  <EditableAccessBadge
                                    state={isEditMode ? dbState : state}
                                    conditionalLabel="Role"
                                    title={reason}
                                    isEditable={isEditMode}
                                    isLoading={isLoading}
                                    onToggle={(newAccess) => handleDepartmentPermissionChange(dept.name, page.page, newAccess)}
                                  />
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Access Tab */}
          <TabsContent value="users" className="mt-0">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>User Permission Overview</CardTitle>
                <CardDescription>See actual user access based on their role and department assignments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="min-w-[200px]">User</TableHead>
                        <TableHead className="min-w-[140px]">Role</TableHead>
                        <TableHead className="min-w-[140px]">Plants</TableHead>
                        <TableHead className="min-w-[180px]">Departments</TableHead>
                        <TableHead className="min-w-[160px]">Special Access</TableHead>
                        <TableHead className="min-w-[100px] text-right">Pages</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scopedUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">
                            No users match your filters
                          </TableCell>
                        </TableRow>
                      ) : (
                        scopedUsers.map((scopedUser) => {
                          const deptNames = getUserDepartmentNames(scopedUser, scopedDepartments);
                          const plantNames = getUserPlantNames(scopedUser, plants);
                          const pageCount = ACCESS_MATRIX_PAGES.filter((page) =>
                            canAccessPage(scopedUser, page.page, dbPermissions)
                          ).length;

                          const specialAccess = [
                            deptNames.some((d) => getDepartmentPageAccessState(d, 'project-create') === 'allowed')
                              ? 'Project Creation'
                              : null,
                            deptNames.some((d) => getDepartmentPageAccessState(d, 'tasks') === 'allowed')
                              ? 'Task Templates'
                              : null,
                            deptNames.some((d) => getDepartmentPageAccessState(d, 'calibration') === 'allowed')
                              ? 'Calibration'
                              : null,
                          ].filter(Boolean);

                          return (
                            <TableRow key={scopedUser.id} className="hover:bg-slate-50/50">
                              <TableCell>
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-slate-900">{scopedUser.name}</div>
                                  <div className="text-xs text-slate-500">{scopedUser.email}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-slate-300 bg-slate-50">
                                  {scopedUser.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">{plantNames.join(', ')}</TableCell>
                              <TableCell className="text-xs text-slate-600">{deptNames.join(', ')}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {specialAccess.length === 0 ? (
                                    <span className="text-xs text-slate-400">—</span>
                                  ) : (
                                    specialAccess.map((access) => (
                                      <Badge key={access} className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                                        {access}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-xs font-semibold text-slate-700">
                                {pageCount} / {ACCESS_MATRIX_PAGES.length}
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
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}