import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../api/axiosInstance';
import { RootState } from '../../store/store';

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'event' | 'meeting' | 'project' | 'task';
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  attendees?: string[];
  description?: string;
  project?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: string;
}

export interface MoMExternalUser {
  name: string;
  organization: string;
  designation: string;
}

export interface MoMActionItem {
  discussionPoint: string;
  action: string;
  responsibilityId: string;
  responsibilityName: string;
  targetDate: string;
  status: 'Open' | 'In Progress' | 'Completed' | 'Blocked';
  remark: string;
}

export interface MoM {
  id: string;
  meetingName: string;
  date: string;
  dtplUsers: string[];
  externalUsers: MoMExternalUser[];
  meetingType: 'internal-to-customer' | 'customer-to-internal' | 'internal-to-supplier' | 'supplier-to-internal';
  agenda: string;
  venue: string;
  meetingLink?: string;
  projectLink?: string;
  discussionPoints?: string;
  assignedUser?: string;
  targetDate?: string;
  status?: 'Open' | 'In Progress' | 'Completed' | 'Blocked';
  discussion: string;
  actionItems?: MoMActionItem[];
  employeeCode?: string;
  nextMeeting?: string;
}

interface CalendarState {
  events: CalendarEvent[];
  moms: MoM[];
  loading: boolean;
  error: string | null;
}

const normalizeDate = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.includes('T') ? value.split('T')[0] : value;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

const normalizeEvent = (event: unknown): CalendarEvent => {
  const record = (event && typeof event === 'object' ? event : {}) as Partial<CalendarEvent> & Record<string, unknown>;

  return {
    id: String(record.id || record._id || ''),
    title: typeof record.title === 'string' ? record.title : '',
    type: record.type === 'meeting' || record.type === 'project' || record.type === 'task' ? record.type : 'event',
    date: normalizeDate(record.date),
    startTime: typeof record.startTime === 'string' ? record.startTime : '',
    endTime: typeof record.endTime === 'string' ? record.endTime : '',
    location: typeof record.location === 'string' ? record.location : '',
    attendees: normalizeStringArray(record.attendees),
    description: typeof record.description === 'string' ? record.description : '',
    project: typeof record.project === 'string' ? record.project : '',
    priority: record.priority === 'low' || record.priority === 'high' ? record.priority : 'medium',
    status: typeof record.status === 'string' ? record.status : '',
  };
};

const normalizeExternalUsers = (value: unknown): MoMExternalUser[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : '',
      organization: typeof item.organization === 'string' ? item.organization : '',
      designation: typeof item.designation === 'string' ? item.designation : '',
    }));
};

const normalizeActionItems = (value: unknown): MoMActionItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      discussionPoint: typeof item.discussionPoint === 'string' ? item.discussionPoint : '',
      action: typeof item.action === 'string' ? item.action : '',
      responsibilityId: typeof item.responsibilityId === 'string' ? item.responsibilityId : '',
      responsibilityName: typeof item.responsibilityName === 'string' ? item.responsibilityName : '',
      targetDate: typeof item.targetDate === 'string' ? item.targetDate : '',
      status:
        item.status === 'In Progress' || item.status === 'Completed' || item.status === 'Blocked'
          ? item.status
          : 'Open',
      remark: typeof item.remark === 'string' ? item.remark : '',
    }));
};

const normalizeMoM = (mom: unknown): MoM => {
  const record = (mom && typeof mom === 'object' ? mom : {}) as Partial<MoM> & Record<string, unknown>;

  return {
    id: String(record.id || record._id || ''),
    meetingName: typeof record.meetingName === 'string' ? record.meetingName : '',
    date: normalizeDate(record.date),
    dtplUsers: normalizeStringArray(record.dtplUsers),
    externalUsers: normalizeExternalUsers(record.externalUsers),
    meetingType:
      record.meetingType === 'customer-to-internal' ||
      record.meetingType === 'internal-to-supplier' ||
      record.meetingType === 'supplier-to-internal'
        ? record.meetingType
        : 'internal-to-customer',
    agenda: typeof record.agenda === 'string' ? record.agenda : '',
    venue: typeof record.venue === 'string' ? record.venue : '',
    meetingLink: typeof record.meetingLink === 'string' ? record.meetingLink : '',
    projectLink: typeof record.projectLink === 'string' ? record.projectLink : '',
    discussionPoints: typeof record.discussionPoints === 'string' ? record.discussionPoints : '',
    assignedUser: typeof record.assignedUser === 'string' ? record.assignedUser : '',
    targetDate: normalizeDate(record.targetDate),
    status:
      record.status === 'In Progress' || record.status === 'Completed' || record.status === 'Blocked'
        ? record.status
        : 'Open',
    discussion: typeof record.discussion === 'string' ? record.discussion : '',
    actionItems: normalizeActionItems(record.actionItems),
    employeeCode: typeof record.employeeCode === 'string' ? record.employeeCode : '',
    nextMeeting: normalizeDate(record.nextMeeting),
  };
};

const initialState: CalendarState = {
  events: [],
  moms: [],
  loading: false,
  error: null,
};

// Async thunks for Events
export const fetchEvents = createAsyncThunk('calendar/fetchEvents', async (_, { rejectWithValue, getState }) => {
  try {
    const state = getState() as RootState;
    const employeeCode = state.auth.user?.employeeCode;
    const employeeName = state.auth.user?.name;
    const response = await axiosInstance.post('/events/list', { employeeCode, employeeName });
    return Array.isArray(response.data) ? response.data.map(normalizeEvent) : [];
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch events');
  }
});

export const createEvent = createAsyncThunk('calendar/createEvent', async (eventData: Omit<CalendarEvent, 'id'>, { rejectWithValue, getState }) => {
  try {
    const employeeCode = (getState() as RootState).auth.user?.employeeCode;
    const response = await axiosInstance.post('/events', { ...eventData, employeeCode });
    return normalizeEvent(response.data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to create event');
  }
});

// Async thunks for MoMs
export const fetchMoMs = createAsyncThunk('calendar/fetchMoMs', async (_, { rejectWithValue, getState }) => {
  try {
    const state = getState() as RootState;
    const employeeCode = state.auth.user?.employeeCode;
    const employeeName = state.auth.user?.name;
    const response = await axiosInstance.post('/moms/list', { employeeCode, employeeName });
    return Array.isArray(response.data) ? response.data.map(normalizeMoM) : [];
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch MoMs');
  }
});

export const createMoM = createAsyncThunk('calendar/createMoM', async (momData: Omit<MoM, 'id'>, { rejectWithValue, getState }) => {
  try {
    const employeeCode = (getState() as RootState).auth.user?.employeeCode;
    const response = await axiosInstance.post('/moms', { ...momData, employeeCode });
    return normalizeMoM(response.data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to create MoM');
  }
});

export const updateMoM = createAsyncThunk(
  'calendar/updateMoM',
  async (
    payload: { id: string; momData: Omit<MoM, 'id' | 'employeeCode'> },
    { rejectWithValue, getState }
  ) => {
    try {
      const employeeCode = (getState() as RootState).auth.user?.employeeCode;
      const response = await axiosInstance.put(`/moms/${payload.id}`, {
        ...payload.momData,
        employeeCode,
      });
      return normalizeMoM(response.data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update MoM');
    }
  }
);

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    clearCalendarError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Events
    builder
      .addCase(fetchEvents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEvents.fulfilled, (state, action: PayloadAction<CalendarEvent[]>) => {
        state.loading = false;
        state.events = action.payload;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createEvent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createEvent.fulfilled, (state, action: PayloadAction<CalendarEvent>) => {
        state.loading = false;
        state.events.push(action.payload);
      })
      .addCase(createEvent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // MoMs
    builder
      .addCase(fetchMoMs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMoMs.fulfilled, (state, action: PayloadAction<MoM[]>) => {
        state.loading = false;
        state.moms = action.payload;
      })
      .addCase(fetchMoMs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createMoM.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createMoM.fulfilled, (state, action: PayloadAction<MoM>) => {
        state.loading = false;
        state.moms.push(action.payload);
      })
      .addCase(createMoM.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateMoM.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateMoM.fulfilled, (state, action: PayloadAction<MoM>) => {
        state.loading = false;
        const index = state.moms.findIndex((mom) => mom.id === action.payload.id);
        if (index >= 0) {
          state.moms[index] = action.payload;
        }
      })
      .addCase(updateMoM.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCalendarError } = calendarSlice.actions;
export default calendarSlice.reducer;
