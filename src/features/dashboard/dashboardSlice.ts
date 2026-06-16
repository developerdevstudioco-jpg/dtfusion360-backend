import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../api/axiosInstance';
import { RootState } from '../../store/store';

export interface KPI {
  title: string;
  value: string | number;
  change: string;
  color: string;
  icon?: string;
}

export interface Task {
  id: string;
  task: string;
  phase?: string;
  status: string;
  dueDate?: string;
  priority?: string;
  assignedTo?: string;
  department?: string;
}

export interface Project {
  id: string;
  name: string;
  status: string;
  progress?: number;
  phase?: string;
}

export interface CalibrationItem {
  id: string;
  name: string;
  dueDate: string;
  status: string;
}

export interface DashboardStats {
  activeProjects: number;
  completedTasks: number;
  overdueItems: number;
  pendingForms: number;
  projectsByPhase: Record<string, number>;
}

export interface DashboardState {
  stats: DashboardStats | null;
  kpis: KPI[];
  tasks: Task[];
  projects: Project[];
  calibrationItems: CalibrationItem[];
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  stats: null,
  kpis: [],
  tasks: [],
  projects: [],
  calibrationItems: [],
  loading: false,
  error: null,
};

// Fetch dashboard statistics and aggregate data
export const fetchDashboardData = createAsyncThunk(
  'dashboard/fetchData',
  async (_, { rejectWithValue, getState }) => {
    try {
      const employeeCode = (getState() as RootState).auth.user?.employeeCode;

      // Fetch projects, tasks, and calibration data in parallel
      const [projectsRes, tasksRes, calibrationRes] = await Promise.allSettled([
        axiosInstance.post('/api/projects/list', { employeeCode }),
        axiosInstance.post('/api/tasks/list', { employeeCode }),
        axiosInstance.post('/api/calibration/list', { employeeCode }).catch(() => ({ data: [] })),
      ]);

      let projects: Project[] = [];
      let tasks: Task[] = [];
      let calibrationItems: CalibrationItem[] = [];

      // Extract data from results
      if (projectsRes.status === 'fulfilled') {
        projects = Array.isArray(projectsRes.value.data)
          ? projectsRes.value.data.map((p: any) => ({
              id: p.id || p._id,
              name: p.name,
              status: p.status || 'active',
              progress: p.progress || 0,
              phase: p.phase || 'Planning',
            }))
          : [];
      }

      if (tasksRes.status === 'fulfilled') {
        tasks = Array.isArray(tasksRes.value.data)
          ? tasksRes.value.data.map((t: any) => ({
              id: t.id || t._id,
              task: t.title || t.name,
              status: t.status || 'pending',
              dueDate: t.dueDate || t.deadline || '',
              priority: t.priority || 'medium',
              phase: t.phase || '',
              assignedTo: t.assignedTo || t.assignedToName || t.assignee || t.owner || '',
              department: t.department || t.departmentName || t.team || '',
            }))
          : [];
      }

      if (calibrationRes.status === 'fulfilled') {
        calibrationItems = Array.isArray(calibrationRes.value.data)
          ? calibrationRes.value.data.map((c: any) => ({
              id: c.id || c._id,
              name: c.instrumentName || c.name,
              dueDate: c.nextCalibrationDate || c.dueDate || '',
              status: c.status || 'pending',
            }))
          : [];
      }

      // Calculate statistics
      const activeProjects = projects.filter(
        (p) => p.status === 'active' || p.status === 'In Progress'
      ).length;

      const completedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'Completed')
        .length;

      const overdueItems = tasks.filter(
        (t) =>
          (t.status === 'overdue' || t.status === 'Overdue') &&
          new Date(t.dueDate) < new Date()
      ).length;

      const pendingForms = tasks.filter(
        (t) => t.status === 'pending' || t.status === 'Pending'
      ).length;

      // Group projects by phase
      const projectsByPhase: Record<string, number> = {};
      projects.forEach((p) => {
        const phase = p.phase || 'Unknown';
        projectsByPhase[phase] = (projectsByPhase[phase] || 0) + 1;
      });

      const stats = {
        activeProjects,
        completedTasks,
        overdueItems,
        pendingForms,
        projectsByPhase,
      };

      return {
        stats,
        projects,
        tasks,
        calibrationItems,
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch dashboard data'
      );
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    clearDashboardError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchDashboardData.fulfilled,
        (
          state,
          action: PayloadAction<{
            stats: DashboardStats;
            projects: Project[];
            tasks: Task[];
            calibrationItems: CalibrationItem[];
          }>
        ) => {
          state.loading = false;
          state.stats = action.payload.stats;
          state.projects = action.payload.projects;
          state.tasks = action.payload.tasks;
          state.calibrationItems = action.payload.calibrationItems;
        }
      )
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearDashboardError } = dashboardSlice.actions;
export default dashboardSlice.reducer;
