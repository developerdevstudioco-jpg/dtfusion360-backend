import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppDispatch } from '../../store/store';

export interface RBACPermission {
  id: string;
  type: 'role' | 'department';
  name: string;
  page: string;
  access: 'allowed' | 'blocked';
}

interface RBACState {
  permissions: RBACPermission[];
}

const STORAGE_KEY = 'rbac_permissions_override';

const initialState: RBACState = {
  permissions: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
};

const rbacSlice = createSlice({
  name: 'rbac',
  initialState,
  reducers: {
    setPermissions: (state, action: PayloadAction<RBACPermission[]>) => {
      state.permissions = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload));
    },
    updatePermission: (state, action: PayloadAction<RBACPermission>) => {
      const existingIndex = state.permissions.findIndex(
        (p) => p.type === action.payload.type && p.name === action.payload.name && p.page === action.payload.page
      );
      
      if (existingIndex >= 0) {
        state.permissions[existingIndex] = action.payload;
      } else {
        state.permissions.push(action.payload);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.permissions));
    },
    // Used internally for cross-tab sync
    _syncFromStorage: (state, action: PayloadAction<RBACPermission[]>) => {
      state.permissions = action.payload;
    },
  },
});

export const { setPermissions, updatePermission, _syncFromStorage } = rbacSlice.actions;
export default rbacSlice.reducer;

/**
 * Call this once in App.tsx to enable real-time cross-tab permission sync.
 * When SuperAdmin saves permissions in Tab A, Tab B (Manager) updates instantly.
 */
export function startRbacStorageSync(dispatch: AppDispatch) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const updated = JSON.parse(e.newValue) as RBACPermission[];
        dispatch(_syncFromStorage(updated));
      } catch {
        // ignore malformed data
      }
    }
  };
  window.addEventListener('storage', handler);
  // Return cleanup function
  return () => window.removeEventListener('storage', handler);
}
