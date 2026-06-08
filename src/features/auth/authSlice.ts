import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../../types';
import { canonicalizeRole } from '../../utils/rbac';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
}

const normalizeArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        return [value];
    }

    return [];
};

const normalizeUser = (user: User): User => {
    const normalizedPlants = normalizeArray(user.plant);
    const normalizedDepartments = normalizeArray(user.department);
    const normalizedPlantIds = normalizeArray(user.plantIds);
    const normalizedDepartmentIds = normalizeArray(user.departmentIds);

    return {
        ...user,
        role: canonicalizeRole(user.role),
        plant: normalizedPlants.length > 0 ? normalizedPlants : normalizedPlantIds,
        department: normalizedDepartments.length > 0 ? normalizedDepartments : normalizedDepartmentIds,
        plantIds: normalizedPlantIds.length > 0 ? normalizedPlantIds : normalizedPlants,
        departmentIds: normalizedDepartmentIds.length > 0 ? normalizedDepartmentIds : normalizedDepartments,
        mustChangePassword: Boolean(user.mustChangePassword),
        status: user.isActive === false ? 'Inactive' : 'Active',
    };
};

const savedUser = localStorage.getItem('user');

const initialState: AuthState = {
    user: savedUser ? normalizeUser(JSON.parse(savedUser)) : null,
    isAuthenticated: !!savedUser,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        login: (state, action: PayloadAction<User>) => {
            state.user = normalizeUser(action.payload);
            state.isAuthenticated = true;
            localStorage.setItem('user', JSON.stringify(state.user));
        },
        logout: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        },
        updateUser: (state, action: PayloadAction<Partial<User>>) => {
            if (state.user) {
                state.user = normalizeUser({ ...state.user, ...action.payload } as User);
                localStorage.setItem('user', JSON.stringify(state.user));
            }
        },
    },
});

export const { login, logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
