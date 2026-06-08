# DT-Fusion360 Change Note

**Period:** Yesterday to now (based on file modification timestamps)

> Note: This summary is derived from workspace file timestamps and modified files. The repository does not appear to be a Git repository, so exact commit metadata is unavailable.

## Frontend Changes

### 1. Authentication and Password Flow
- Updated login flow and routing in `src/App.tsx`.
- Added or refined password change handling via `src/features/auth/components/ForcePasswordChange.tsx`.
- Updated authentication state management in `src/features/auth/authSlice.ts`.
- Added support for redirecting users who must change passwords before accessing the app.

### 2. RBAC and Access Control
- Added/updated RBAC UI and logic in `src/components/RBAC.tsx`.
- Implemented new RBAC API client methods in `src/api/rbacApi.ts` for:
  - Getting all permissions
  - Getting role and department permissions
  - Updating role/department permissions
  - Bulk updating permissions
  - Deleting permissions
  - Fetching audit logs
- Expanded role normalization and access matrix logic in `src/utils/rbac.ts`.
- Added RBAC-related layout and dashboard support in `src/utils/branding.ts` and `src/layouts/DashboardLayout.tsx`.

### 3. User and Organization Management
- Updated organization state handling in `src/features/organization/organizationSlice.ts`.
- Updated user state handling in `src/features/users/userSlice.ts`.
- Updated user and registration UI in `src/components/UserRegistration.tsx`, `src/components/UserManagement.tsx`, and `src/components/PasswordSetup.tsx`.
- Added security-related UI improvements in `src/components/Settings.tsx` and `src/components/ui/password-input.tsx`.

### 4. Projects, Tasks, and Calibration
- Modified project-related components:
  - `src/components/projects/ProjectList.tsx`
  - `src/components/projects/ProjectForm.tsx`
  - `src/components/projects/ProjectDetail.tsx`
  - `src/components/projects/APQPWorkflow.tsx`
- Updated task management UI in `src/components/TaskManagement.tsx`.
- Updated calibration module UI in `src/components/CalibrationManagement.tsx`.

### 5. UI/UX and Support Components
- Updated switch component styling/behavior in `src/components/ui/switch.tsx`.
- Updated settings and branding behavior in `src/utils/branding.ts`.
- Improved dashboard user experience via `src/features/dashboard/components/files/UserDashboard.tsx` and `src/features/dashboard/components/files/roleUtils.ts`.
- Updated plant and department management UI in `src/components/PlantDepartmentManagement.tsx`.
- Updated mocked workflow data in `src/mocks/projectWorkflow.ts`.

## Backend Changes

### 1. Authentication Backend
- Updated backend auth API in `Super Admin Backend - V7/src/routes/authRoutes.js` and `Super Admin Backend - V7/src/controllers/authController.js`.
- Added password complexity validation and new password flow.
- Added token verification and must-change-password support.
- Added inactive-user checks and better error handling.

### 2. RBAC Backend
- Added RBAC routes in `Super Admin Backend - V7/src/routes/rbacRoutes.js`.
- Implemented RBAC controllers in `Super Admin Backend - V7/src/controllers/rbacController.js`.
- Added RBAC model support in `Super Admin Backend - V7/src/models/RBAC.js`.
- Added endpoints for:
  - get all permissions
  - get role/department permissions
  - update role/department permissions
  - bulk permissions updates
  - delete permissions
  - permission audit log

### 3. Organization and User Management Backend
- Updated organization routes in `Super Admin Backend - V7/src/routes/organizationRoutes.js`.
- Enhanced organization controller logic in `Super Admin Backend - V7/src/controllers/organizationController.js`.
- Added stronger plant validation and duplicate checking.
- Added auto-creation of standard departments when new plants are created.
- Added plant delete behavior that cascades department and team cleanup.
- Improved user lookup and assignment resolution.
- Added password generation rules and user account creation support.

### 4. Account Email and Notifications
- Added account email creation template in `Super Admin Backend - V7/src/utils/accountCreationTemplate.js`.
- Added SMTP email sending support in `Super Admin Backend - V7/src/services/accountEmailService.js`.
- Support for environment-driven SMTP configuration and fallback handling.

### 5. Server and Environment
- Backend server entrypoint updated in `Super Admin Backend - V7/src/server.js`.
- Added static serving for uploads and built frontend assets.
- `.env` now includes `VITE_API_BASE_URL=https://dtfusion360-backend.onrender.com/`.
- Backend environment file updated in `Super Admin Backend - V7/.env`.
- Backend package configuration updated in `Super Admin Backend - V7/package.json`.

## Build and Miscellaneous Changes
- Build output regenerated under `build/` and `build/assets/`.
- Frontend logging files created: `frontend-dev.err.log`, `frontend-dev.out.log`.
- Backend logging files created: `Super Admin Backend - V7/backend-dev.err.log`, `Super Admin Backend - V7/backend-dev.out.log`, `Super Admin Backend - V7/backend-start.err.log`, `Super Admin Backend - V7/backend-start.out.log`.
- Node module files in the backend changed due to dependency updates/installations (not source logic).

## Key Files Changed

- Frontend:
  - `src/App.tsx`
  - `src/api/rbacApi.ts`
  - `src/utils/rbac.ts`
  - `src/components/RBAC.tsx`
  - `src/features/auth/authSlice.ts`
  - `src/features/auth/components/Login.tsx`
  - `src/features/auth/components/ForcePasswordChange.tsx`
  - `src/features/organization/organizationSlice.ts`
  - `src/features/users/userSlice.ts`
  - `src/components/PlantDepartmentManagement.tsx`
  - `src/components/TaskManagement.tsx`
  - `src/components/CalibrationManagement.tsx`

- Backend:
  - `Super Admin Backend - V7/src/server.js`
  - `Super Admin Backend - V7/src/routes/authRoutes.js`
  - `Super Admin Backend - V7/src/controllers/authController.js`
  - `Super Admin Backend - V7/src/routes/rbacRoutes.js`
  - `Super Admin Backend - V7/src/controllers/rbacController.js`
  - `Super Admin Backend - V7/src/routes/organizationRoutes.js`
  - `Super Admin Backend - V7/src/controllers/organizationController.js`
  - `Super Admin Backend - V7/src/utils/accountCreationTemplate.js`
  - `Super Admin Backend - V7/src/services/accountEmailService.js`

---

**Summary:**
The last day of work focused on strengthening authentication, password flows, RBAC permission management, and organization/user management across both frontend and backend. It also includes environment updates, static asset serving, and regenerated build artifacts.
