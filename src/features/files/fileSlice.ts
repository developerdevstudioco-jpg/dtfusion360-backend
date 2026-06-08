import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../api/axiosInstance';
import { RootState } from '../../store/store';

export interface FileRevision {
  id: string;
  fileName: string;
  revision: string;
  uploadedBy: string;
  uploadedDate: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approver?: string;
  approvedDate?: string;
  notes?: string;
  isLatest: boolean;
  fileType: string;
}

export interface FileItem {
  id: string;
  name: string;
  revisions: FileRevision[];
  category: string;
  department: string;
}

export interface Subdomain {
  id: string;
  name: string;
  files: FileItem[];
}

export interface MainFolder {
  id: string;
  name: string;
  subdomains: Subdomain[];
  department?: string;
}

export interface PendingUpload {
  id: string;
  folderId: string;
  subdomainId: string;
  file?: FileItem; // For new files
  fileId?: string; // For new revisions
  revision?: FileRevision; // For new revisions
  uploadedDate: string;
  uploader: string;
  status: 'pending' | 'approved' | 'rejected';
  type: 'file' | 'revision';
}

export interface FileState {
  folders: MainFolder[];
  loading: boolean;
  error: string | null;
  managers: string[];
  pendingUploads: PendingUpload[];
}

const initialState: FileState = {
  folders: [],
  loading: false,
  error: null,
  managers: [],
  pendingUploads: [],
};

// Async Thunks
export const fetchManagersAsync = createAsyncThunk(
  'files/fetchManagers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/managers/list');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch managers');
    }
  }
);

export const fetchFilesAsync = createAsyncThunk(
  'files/fetchFiles',
  async (_, { rejectWithValue, getState }) => {
    try {
      const employeeCode = (getState() as RootState).auth.user?.employeeCode;
      const response = await axiosInstance.post('/api/files/list', { employeeCode });
      return response.data; // Expected to return an array of MainFolder
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch files');
    }
  }
);

export const uploadFileAsync = createAsyncThunk(
  'files/uploadFile',
  async (payload: FormData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/files/upload', payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload file');
    }
  }
);

export const uploadRevisionAsync = createAsyncThunk(
  'files/uploadRevision',
  async (payload: FormData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/files/revision', payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload file revision');
    }
  }
);

export const createFolderAsync = createAsyncThunk(
  'files/createFolder',
  async (folder: { name: string; department?: string }, { rejectWithValue, getState }) => {
    try {
      const employeeCode = (getState() as RootState).auth.user?.employeeCode;
      const response = await axiosInstance.post('/api/files/folders', { ...folder, employeeCode });
      const data = response.data?.folder || response.data;
      return {
        ...data,
        id: data.id || data._id,
        subdomains: data.subdomains || []
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create folder');
    }
  }
);

export const createSubdomainAsync = createAsyncThunk(
  'files/createSubdomain',
  async (payload: { folderId: string; name: string }, { rejectWithValue, getState }) => {
    try {
      const employeeCode = (getState() as RootState).auth.user?.employeeCode;
      const response = await axiosInstance.post('/api/files/subdomains', { ...payload, employeeCode });
      const data = response.data?.subdomain || response.data;
      const subdomain = {
        ...data,
        id: data.id || data._id,
        files: data.files || []
      };
      return { folderId: payload.folderId, subdomain };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create subdomain');
    }
  }
);


export const fetchPendingUploadsAsync = createAsyncThunk(
  'files/fetchPendingUploads',
  async (_, { rejectWithValue, getState }) => {
    try {
      const employeeCode = (getState() as RootState).auth.user?.employeeCode;
      const response = await axiosInstance.post('/api/files/pending/list', { employeeCode });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch pending uploads');
    }
  }
);

export const approvePendingUploadAsync = createAsyncThunk(
  'files/approvePendingUpload',
  async (payload: { pendingId: string; type: 'file' | 'revision'; folderId: string; subdomainId: string; fileId?: string; file?: any; revision?: any }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/files/approve', payload);
      return payload; // Return payload to update local state
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to approve upload');
    }
  }
);

const fileSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    // ==== Folders ====
    addFolder: (state, action: PayloadAction<MainFolder>) => {
      state.folders.push(action.payload);
    },
    updateFolder: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const folder = state.folders.find(f => f.id === action.payload.id);
      if (folder) folder.name = action.payload.name;
    },
    deleteFolder: (state, action: PayloadAction<string>) => {
      state.folders = state.folders.filter(f => f.id !== action.payload);
    },

    // ==== Subdomains ====
    addSubdomain: (state, action: PayloadAction<{ folderId: string; subdomain: Subdomain }>) => {
      const folder = state.folders.find(f => f.id === action.payload.folderId);
      if (folder) folder.subdomains.push(action.payload.subdomain);
    },
    updateSubdomain: (state, action: PayloadAction<{ folderId: string; subId: string; name: string }>) => {
      const folder = state.folders.find(f => f.id === action.payload.folderId);
      if (folder) {
        const sub = folder.subdomains.find(s => s.id === action.payload.subId);
        if (sub) sub.name = action.payload.name;
      }
    },
    deleteSubdomain: (state, action: PayloadAction<{ folderId: string; subId: string }>) => {
      const folder = state.folders.find(f => f.id === action.payload.folderId);
      if (folder) {
        folder.subdomains = folder.subdomains.filter(s => s.id !== action.payload.subId);
      }
    },

    // ==== Files ====
    addFile: (state, action: PayloadAction<{ folderId: string; subId: string; file: FileItem }>) => {
      const folder = state.folders.find(f => f.id === action.payload.folderId);
      if (folder) {
        const sub = folder.subdomains.find(s => s.id === action.payload.subId);
        if (sub) sub.files.push(action.payload.file);
      }
    },
    updateFile: (state, action: PayloadAction<{ folderId: string; subId: string; fileId: string; name: string }>) => {
      const folder = state.folders.find(f => f.id === action.payload.folderId);
      if (folder) {
        const sub = folder.subdomains.find(s => s.id === action.payload.subId);
        if (sub) {
          const file = sub.files.find(f => f.id === action.payload.fileId);
          if (file) file.name = action.payload.name;
        }
      }
    },
    deleteFile: (state, action: PayloadAction<{ folderId: string; subId: string; fileId: string }>) => {
      const folder = state.folders.find(f => f.id === action.payload.folderId);
      if (folder) {
        const sub = folder.subdomains.find(s => s.id === action.payload.subId);
        if (sub) {
          sub.files = sub.files.filter(f => f.id !== action.payload.fileId);
        }
      }
    },
    addFileRevision: (state, action: PayloadAction<{ folderId: string; subId: string; fileId: string; revision: FileRevision }>) => {
      const folder = state.folders.find(f => f.id === action.payload.folderId);
      if (folder) {
        const sub = folder.subdomains.find(s => s.id === action.payload.subId);
        if (sub) {
          const file = sub.files.find(f => f.id === action.payload.fileId);
          if (file) {
            file.revisions.forEach(r => r.isLatest = false);
            file.revisions.push(action.payload.revision);
          }
        }
      }
    },
    // ==== Pending Uploads ====
    addPendingUpload: (state, action: PayloadAction<PendingUpload>) => {
      state.pendingUploads.push(action.payload);
    },
    removePendingUpload: (state, action: PayloadAction<string>) => {
      state.pendingUploads = state.pendingUploads.filter(p => p.id !== action.payload);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchManagersAsync.fulfilled, (state, action) => {
        state.managers = action.payload || [];
      })
      .addCase(fetchFilesAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFilesAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (Array.isArray(action.payload)) {
          state.folders = action.payload.map(folder => ({
            ...folder,
            id: folder.id || folder._id,
            subdomains: (folder.subdomains || []).map((sub: any) => ({
              ...sub,
              id: sub.id || sub._id,
              files: sub.files || []
            }))
          }));
        }
      })

      .addCase(fetchFilesAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createFolderAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(createFolderAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.folders.push(action.payload);
      })
      .addCase(createFolderAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createSubdomainAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(createSubdomainAsync.fulfilled, (state, action) => {
        state.loading = false;
        const folder = state.folders.find(f => f.id === action.payload.folderId);
        if (folder) {
          folder.subdomains.push(action.payload.subdomain);
        }
      })
      .addCase(createSubdomainAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchPendingUploadsAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(fetchPendingUploadsAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchPendingUploadsAsync.fulfilled, (state, action) => {
        if (Array.isArray(action.payload)) {
          state.pendingUploads = action.payload.map(p => {
            // Transform backend data to PendingUpload interface
            const isRevision = !!p.fileId; // If fileId exists, it's a revision

            return {
              id: p.id || p._id,
              folderId: p.folderId,
              subdomainId: p.subdomainId,
              fileId: p.fileId, // fileId indicates this is a revision
              uploadedDate: p.createdAt || p.uploadedDate || new Date().toISOString().split('T')[0],
              uploader: p.uploadedBy || 'system',
              status: (p.status as 'pending' | 'approved' | 'rejected') || 'pending',
              type: isRevision ? 'revision' : 'file',
              // For new files, store file data
              ...(isRevision ? {
                revision: {
                  id: p.fileId || Date.now().toString(),
                  fileName: p.fileName,
                  revision: '1',
                  uploadedBy: p.uploadedBy || 'system',
                  uploadedDate: p.createdAt || p.uploadedDate || new Date().toISOString().split('T')[0],
                  approvalStatus: (p.status === 'pending' ? 'pending' : 'approved') as 'pending' | 'approved' | 'rejected',
                  isLatest: true,
                  fileType: p.fileName?.split('.').pop() || 'unknown'
                }
              } : {
                file: {
                  id: p.id || p._id,
                  name: p.fileName,
                  revisions: [{
                    id: p.id || p._id,
                    fileName: p.fileName,
                    revision: '1',
                    uploadedBy: p.uploadedBy || 'system',
                    uploadedDate: p.createdAt || p.uploadedDate || new Date().toISOString().split('T')[0],
                    approvalStatus: (p.status === 'pending' ? 'pending' : 'approved') as 'pending' | 'approved' | 'rejected',
                    isLatest: true,
                    fileType: p.fileName?.split('.').pop() || 'unknown'
                  }],
                  category: 'Uncategorized',
                  department: 'General'
                }
              })
            };
          });
        }
      })
      .addCase(approvePendingUploadAsync.fulfilled, (state, action) => {
        const payload = action.payload;
        // Remove from pending
        state.pendingUploads = state.pendingUploads.filter(p => p.id !== payload.pendingId);

        // Optimistically add to main folder
        const folder = state.folders.find(f => f.id === payload.folderId);
        if (folder) {
          const sub = folder.subdomains.find(s => s.id === payload.subdomainId);
          if (sub) {
            if (payload.type === 'file' && payload.file) {
              if (!sub.files) sub.files = [];
              sub.files.push({
                ...payload.file,
                revisions: payload.file.revisions.map((rev: any) => ({ ...rev, approvalStatus: 'approved', isLatest: true }))
              });
            } else if (payload.type === 'revision' && payload.revision && payload.fileId) {
              const file = sub.files.find(f => f.id === payload.fileId);
              if (file) {
                file.revisions.forEach(r => r.isLatest = false);
                file.revisions.push({ ...payload.revision, approvalStatus: 'approved', isLatest: true });
              }
            }
          }
        }
      });
  }
});

export const {
  addFolder, updateFolder, deleteFolder,
  addSubdomain, updateSubdomain, deleteSubdomain,
  addFile, updateFile, deleteFile, addFileRevision,
  addPendingUpload, removePendingUpload
} = fileSlice.actions;

export default fileSlice.reducer;
