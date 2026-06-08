import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { login, logout } from './features/auth/authSlice';
import { startRbacStorageSync } from './features/rbac/rbacSlice';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { store } from './store/store';
import { Page, User } from './types';
import { isPlantAdminRole, isSuperAdminRole } from './features/dashboard/components/files/roleUtils';
import { canAccessPage } from './utils/rbac';
import { WebSocketProvider } from './providers/WebsocketProvider';

// Re-export types for backward compatibility with components importing from App
export * from './types';

// Lazy loaded components
const UserDashboard = lazy(() => import('./features/dashboard/components/files/UserDashboard'));
const ProjectList = lazy(() => import('./components/projects/ProjectList'));
const ProjectForm = lazy(() => import('./components/projects/ProjectForm'));
const ProjectDetail = lazy(() => import('./components/projects/ProjectDetail'));
const TaskManagement = lazy(() => import('./components/TaskManagement'));
const RequesterForms = lazy(() => import('./components/RequesterForms'));
const FileManagement = lazy(() => import('./components/FileManagement'));
const CalibrationManagement = lazy(() => import('./components/CalibrationManagement'));
// Updated: MessageHub now uses local state instead of Supabase
const MessageHub = lazy(() => import('./components/MessageHub'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const SuperAdminDashboard = lazy(() => import('./features/dashboard/components/files/dashboards/SuperAdminDashboard'));
const PlantAdminDashboard = lazy(() => import('./features/dashboard/components/files/dashboards/PlantAdminDashboard'));
const Settings = lazy(() => import('./components/Settings'));
const Calendar = lazy(() => import('./components/Calendar'));
const BulkUpload = lazy(() => import('./components/BulkUpload'));
const RBAC = lazy(() => import('./components/RBAC'));
const LogMonitoring = lazy(() => import('./components/LogMonitoring'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const PlantDepartmentManagement = lazy(() => import('./components/PlantDepartmentManagement'));
const BackendIntegrationSample = lazy(() => import('./Backend-integration-sample'));
const SecurityCompliance = lazy(() => import('./features/admin/components/SecurityCompliance'));
const LogsAuditPane = lazy(() => import('./features/admin/components/LogsAuditPane'));

// Updated Login import
const Login = lazy(() => import('./features/auth/components/Login'));
const ForcePasswordChange = lazy(() => import('./features/auth/components/ForcePasswordChange'));

// Ordered list of sidebar pages — used to find the first allowed page on redirect
const SIDEBAR_PAGES: { id: Page; route: string }[] = [
  { id: 'dashboard', route: '/dashboard' },
  { id: 'calendar', route: '/calendar' },
  { id: 'projects', route: '/projects' },
  { id: 'tasks', route: '/tasks' },
  { id: 'forms', route: '/forms' },
  { id: 'files', route: '/files' },
  { id: 'calibration', route: '/calibration' },
  { id: 'messages', route: '/messages' },
];

// Protected Route — reads ALL state from Redux, no stale closures
function ProtectedRoute({ children, page }: { children: React.ReactNode; page: Page }) {
  const currentUser = useAppSelector(state => state.auth.user);
  const permissions = useAppSelector(state => state.rbac.permissions);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.mustChangePassword) return <Navigate to="/change-password" replace />;

  if (!canAccessPage(currentUser, page, permissions)) {
    // Find the first page from the sidebar list that this user can access
    const firstAllowed = SIDEBAR_PAGES.find(p => canAccessPage(currentUser, p.id, permissions));
    return <Navigate to={firstAllowed?.route ?? '/settings'} replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const currentUser = useAppSelector(state => state.auth.user);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Sync RBAC permissions across browser tabs in real-time
  useEffect(() => {
    const cleanup = startRbacStorageSync(dispatch);
    return cleanup;
  }, [dispatch]);

  // Determine the landing page for a user based on their role and RBAC permissions
  const getHomePage = (targetUser: User): string => {
    const currentPermissions = store.getState().rbac.permissions;
    if (isSuperAdminRole(targetUser.role)) return '/super-admin-dashboard';
    if (isPlantAdminRole(targetUser.role)) return '/plant-admin-dashboard';
    const firstAllowed = SIDEBAR_PAGES.find(p => canAccessPage(targetUser, p.id, currentPermissions));
    return firstAllowed?.route ?? '/settings';
  };

  // Handle user switching (SuperAdmin only)
  const handleUserChange = (newUser: User) => {
    dispatch(login(newUser));
    if (newUser.mustChangePassword) {
      navigate('/change-password');
      return;
    }
    navigate(getHomePage(newUser));
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  //this is for sideNavBar
  const handleNavigate = (page: Page, projectId?: string) => {
    if (projectId) {
      setSelectedProjectId(projectId);
    }

    const routeMap: Record<Page, string> = {
      'dashboard': '/dashboard',
      'user-dashboard': '/dashboard',
      'projects': '/projects',
      'project-create': '/project-create',
      'project-detail': '/project-detail',
      'project-edit': '/project-edit',
      'tasks': '/tasks',
      'forms': '/forms',
      'files': '/files',
      'calibration': '/calibration',
      'messages': '/messages',
      'chat': '/messages',
      'admin': '/admin',
      'super-admin-dashboard': '/super-admin-dashboard',
      'plant-admin-dashboard': '/plant-admin-dashboard',
      'settings': '/settings',
      'calendar': '/calendar',
      'bulk-upload': '/bulk-upload',
      'rbac': '/rbac',
      'logs': '/logs',
      'user-management': '/user-management',
      'organization-management': '/organization-management',
      'security-compliance': '/security-compliance',
      'audit-logs': '/audit-logs',
      'BackendIntegrationSample': '/BackendIntegrationSample'
    };

    const route = routeMap[page];
    if (route) {
      navigate(route);
    } else {
      console.warn(`No route found for page: ${page}`);
    }
  };

  // ProtectedRoute is now defined outside AppContent - see top of file

  // Loading wrapper
  const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen space-x-2">
      <div className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
      <div className="h-3 w-3 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
      <div className="h-3 w-3 animate-bounce rounded-full bg-primary"></div>
    </div>
  );
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={
            !currentUser ?
              <Login /> :
              <Navigate to={currentUser.mustChangePassword ? "/change-password" : getHomePage(currentUser)} replace />
          } />

          <Route path="/" element={<Navigate to={currentUser ? (currentUser.mustChangePassword ? "/change-password" : getHomePage(currentUser)) : "/login"} replace />} />

          <Route path="/change-password" element={
            currentUser ?
              (currentUser.mustChangePassword ? <ForcePasswordChange /> : <Navigate to="/dashboard" replace />) :
              <Navigate to="/login" replace />
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute page="dashboard">
              <UserDashboard user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/projects" element={
            <ProtectedRoute page="projects">
              <ProjectList user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/project-create" element={
            <ProtectedRoute page="project-create">
              <ProjectForm user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} onCancel={() => handleNavigate('projects')} />
            </ProtectedRoute>
          } />
          <Route path="/project-detail" element={
            <ProtectedRoute page="project-detail">
              {selectedProjectId ? (
                <ProjectDetail user={currentUser!} projectId={selectedProjectId} onNavigate={handleNavigate} onLogout={handleLogout} />
              ) : (
                <Navigate to="/projects" replace />
              )}
            </ProtectedRoute>
          } />
          <Route path="/project-edit" element={
            <ProtectedRoute page="project-edit">
              {selectedProjectId ? (
                <ProjectForm user={currentUser!} editProjectId={selectedProjectId} onNavigate={handleNavigate} onLogout={handleLogout} onCancel={() => handleNavigate('projects')} />
              ) : (
                <Navigate to="/projects" replace />
              )}
            </ProtectedRoute>
          } />
          <Route path="/tasks" element={
            <ProtectedRoute page="tasks">
              <TaskManagement user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/forms" element={
            <ProtectedRoute page="forms">
              <RequesterForms user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/files" element={
            <ProtectedRoute page="files">
              <FileManagement user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/calibration" element={
            <ProtectedRoute page="calibration">
              <CalibrationManagement user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/messages" element={
            <ProtectedRoute page="messages">
              <MessageHub user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/chat" element={
            <Navigate to="/messages" replace />
          } />
          <Route path="/admin" element={
            <ProtectedRoute page="admin">
              <AdminPanel user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/super-admin-dashboard" element={
            <ProtectedRoute page="super-admin-dashboard">
              <UserDashboard user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/plant-admin-dashboard" element={
            <ProtectedRoute page="plant-admin-dashboard">
              <UserDashboard user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute page="settings">
              <Settings user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/calendar" element={
            <ProtectedRoute page="calendar">
              <Calendar user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/bulk-upload" element={
            <ProtectedRoute page="bulk-upload">
              <BulkUpload user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/rbac" element={
            <ProtectedRoute page="rbac">
              <RBAC user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/logs" element={
            <ProtectedRoute page="logs">
              <LogMonitoring user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/user-management" element={
            <ProtectedRoute page="user-management">
              <UserManagement user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/organization-management" element={
            <ProtectedRoute page="organization-management">
              <PlantDepartmentManagement user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/security-compliance" element={
            <ProtectedRoute page="security-compliance">
              <SecurityCompliance user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/audit-logs" element={
            <ProtectedRoute page="audit-logs">
              <LogsAuditPane user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />
          <Route path="/BackendIntegrationSample" element={
            <ProtectedRoute page="BackendIntegrationSample">
              <BackendIntegrationSample user={currentUser!} onNavigate={handleNavigate} onLogout={handleLogout} />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to={currentUser ? (currentUser.mustChangePassword ? "/change-password" : "/dashboard") : "/login"} replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <HashRouter>
        <WebSocketProvider>
          <AppContent />
        </WebSocketProvider>
      </HashRouter>
    </Provider>
  );
}
