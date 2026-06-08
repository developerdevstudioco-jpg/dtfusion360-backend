import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TaskTemplate } from '../../types';
import axiosInstance from '../../api/axiosInstance';

interface TaskState {
    tasks: TaskTemplate[];
    groups: TaskGroup[];
    loading: boolean;
    error: string | null;
}

const initialState: TaskState = {
    tasks: [],
    groups: [],
    loading: false,
    error: null,
};

// Async Thunks - POST requests as specified
export const fetchTaskTemplates = createAsyncThunk(
    'tasks/fetchTemplates',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.post('/api/tasks/list', {});
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch task templates');
        }
    }
);

export const addTaskTemplate = createAsyncThunk(
    'tasks/addTemplate',
    async (taskData: Omit<TaskTemplate, 'id'>, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.post('/api/tasks/add', taskData);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to add task template');
        }
    }
);

export const updateTaskTemplate = createAsyncThunk(
    'tasks/updateTemplate',
    async (taskData: TaskTemplate, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.post('/api/tasks/update', taskData);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to update task template');
        }
    }
);

export const deleteTaskTemplate = createAsyncThunk(
    'tasks/deleteTemplate',
    async (id: string, { rejectWithValue }) => {
        try {
            await axiosInstance.post('/api/tasks/delete', { id });
            return id;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to delete task template');
        }
    }
);

const taskSlice = createSlice({
    name: 'tasks',
    initialState,
    reducers: {
        addTaskGroup(state, action: PayloadAction<TaskGroup>) {
            state.groups.push(action.payload);
        },
        deleteTaskGroup(state, action: PayloadAction<string>) {
            state.groups = state.groups.filter((group) => group.id !== action.payload);
        },
        updateTaskGroup(state, action: PayloadAction<TaskGroup>) {
            const index = state.groups.findIndex((group) => group.id === action.payload.id);
            if (index !== -1) {
                state.groups[index] = action.payload;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTaskTemplates.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchTaskTemplates.fulfilled, (state, action: PayloadAction<TaskTemplate[]>) => {
                state.loading = false;
                state.tasks = action.payload;
            })
            .addCase(fetchTaskTemplates.rejected, (state, action: any) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(addTaskTemplate.fulfilled, (state, action: PayloadAction<TaskTemplate>) => {
                state.tasks.push(action.payload);
            })
            .addCase(updateTaskTemplate.fulfilled, (state, action: PayloadAction<TaskTemplate>) => {
                const index = state.tasks.findIndex(t => t.id === action.payload.id);
                if (index !== -1) {
                    state.tasks[index] = action.payload;
                }
            })
            .addCase(deleteTaskTemplate.fulfilled, (state, action: PayloadAction<string>) => {
                state.tasks = state.tasks.filter(t => t.id !== action.payload);
            });
    },
});

export const { addTaskGroup, deleteTaskGroup, updateTaskGroup } = taskSlice.actions;
export default taskSlice.reducer;