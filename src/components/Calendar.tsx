import {
  Calendar as CalendarIcon,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  FolderKanban,
  MapPin,
  Plus,
  Users,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Page, User } from '../App';
import { createEvent, createMoM, fetchEvents, fetchMoMs, MoM } from '../features/calendar/calendarSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import Layout from './Layout';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

interface CalendarProps {
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

// Mock users for attendees multiselect
const MOCK_USERS = [
  { id: '1', name: 'John Smith', email: 'john@example.com', department: 'Engineering' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@example.com', department: 'Management' },
  { id: '3', name: 'Mike Chen', email: 'mike@example.com', department: 'Quality' },
  { id: '4', name: 'Emma Davis', email: 'emma@example.com', department: 'Engineering' },
  { id: '5', name: 'Alex Kumar', email: 'alex@example.com', department: 'Operations' },
  { id: '6', name: 'Lisa Anderson', email: 'lisa@example.com', department: 'Management' },
  { id: '7', name: 'James Wilson', email: 'james@example.com', department: 'Engineering' },
  { id: '8', name: 'Rachel Green', email: 'rachel@example.com', department: 'Quality' },
];



const CalendarSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-500">
    {/* Left Area Skeleton (Calendar view) */}
    <Card className="lg:col-span-2" style={{ borderRadius: '12px' }}>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="flex space-x-2">
            <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
            <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
        {/* Calendar Grid Skeleton */}
        <div className="space-y-2">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="text-center p-2 flex justify-center">
                <div className="h-4 w-8 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7 gap-2">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="min-h-[80px] p-2 rounded-lg border bg-white flex flex-col items-start">
                <div className="h-4 w-6 bg-slate-200 rounded mb-2 animate-pulse" />
                <div className="space-y-1 w-full">
                  {i % 4 === 0 && <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />}
                  {i % 7 === 0 && <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Right Area Skeleton */}
    <div className="space-y-6">
      {/* Quick Actions Skeleton */}
      <Card style={{ borderRadius: '12px', backgroundColor: '#f9f9f9' }}>
        <CardContent className="p-4 space-y-4">
          <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-10 w-full bg-slate-200 rounded animate-pulse" />
          <div className="h-10 w-full bg-slate-200 rounded animate-pulse" />
        </CardContent>
      </Card>
      {/* Selected Events Skeleton */}
      <Card style={{ borderRadius: '12px' }}>
        <CardContent className="p-4 space-y-4">
          <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-3">
              <div className="flex justify-between">
                <div className="h-5 w-1/2 bg-slate-200 rounded animate-pulse" />
                <div className="h-5 w-16 bg-slate-200 rounded-full animate-pulse" />
              </div>
              <div className="h-4 w-1/3 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-1/4 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  </div>
);

export default function Calendar({ user, onNavigate, onLogout }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [createMoMOpen, setCreateMoMOpen] = useState(false);
  const [viewMoMOpen, setViewMoMOpen] = useState(false);
  const [selectedMoM, setSelectedMoM] = useState<MoM | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  // Event form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState<'event' | 'meeting'>('event');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventAttendees, setEventAttendees] = useState<{ id: string; name: string }[]>([]);
  const [attendeeInput, setAttendeeInput] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<typeof MOCK_USERS>([]);
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
  const [eventDescription, setEventDescription] = useState('');
  const [linkedProject, setLinkedProject] = useState('');

  // MoM form state
  const [momName, setMomName] = useState('');
  const [momDate, setMomDate] = useState('');
  const [momDtplAttendees, setMomDtplAttendees] = useState<{ id: string; name: string }[]>([]);
  const [momAttendeeInput, setMomAttendeeInput] = useState('');
  const [filteredMomUsers, setFilteredMomUsers] = useState<typeof MOCK_USERS>([]);
  const [showMomAttendeeDropdown, setShowMomAttendeeDropdown] = useState(false);
  const [momExternalUsers, setMomExternalUsers] = useState<{ name: string; organization: string; designation: string }[]>([
    { name: '', organization: '', designation: '' }
  ]);
  const [momMeetingType, setMomMeetingType] = useState<'internal-to-customer' | 'customer-to-internal' | 'internal-to-supplier' | 'supplier-to-internal'>('internal-to-customer');
  const [momAgenda, setMomAgenda] = useState('');
  const [momVenue, setMomVenue] = useState('');
  const [momMeetingLink, setMomMeetingLink] = useState('');
  const [momDiscussion, setMomDiscussion] = useState('');
  const [momNextMeeting, setMomNextMeeting] = useState('');

  const dispatch = useAppDispatch();
  const { events, moms, loading } = useAppSelector((state) => state.calendar);

  useEffect(() => {
    dispatch(fetchEvents());
    dispatch(fetchMoMs());
  }, [dispatch]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days in month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
      if (filterType === 'all') return event.date === dateStr;
      return event.date === dateStr && event.type === filterType;
    });
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // Attendee multiselect handlers
  const handleAttendeeInputChange = (value: string) => {
    setAttendeeInput(value);
    if (value.trim()) {
      const filtered = MOCK_USERS.filter(user => 
        !eventAttendees.some(attendee => attendee.id === user.id) &&
        (user.name.toLowerCase().includes(value.toLowerCase()) ||
         user.email.toLowerCase().includes(value.toLowerCase()))
      );
      setFilteredUsers(filtered);
      setShowAttendeeDropdown(true);
    } else {
      setFilteredUsers([]);
      setShowAttendeeDropdown(false);
    }
  };

  const handleAddAttendee = (user: typeof MOCK_USERS[0]) => {
    setEventAttendees([...eventAttendees, { id: user.id, name: user.name }]);
    setAttendeeInput('');
    setFilteredUsers([]);
    setShowAttendeeDropdown(false);
  };

  const handleRemoveAttendee = (userId: string) => {
    setEventAttendees(eventAttendees.filter(a => a.id !== userId));
  };

  // MoM Attendee multiselect handlers
  const handleMomAttendeeInputChange = (value: string) => {
    setMomAttendeeInput(value);
    if (value.trim()) {
      const filtered = MOCK_USERS.filter(user => 
        !momDtplAttendees.some(attendee => attendee.id === user.id) &&
        (user.name.toLowerCase().includes(value.toLowerCase()) ||
         user.email.toLowerCase().includes(value.toLowerCase()))
      );
      setFilteredMomUsers(filtered);
      setShowMomAttendeeDropdown(true);
    } else {
      setFilteredMomUsers([]);
      setShowMomAttendeeDropdown(false);
    }
  };

  const handleAddMomAttendee = (user: typeof MOCK_USERS[0]) => {
    setMomDtplAttendees([...momDtplAttendees, { id: user.id, name: user.name }]);
    setMomAttendeeInput('');
    setFilteredMomUsers([]);
    setShowMomAttendeeDropdown(false);
  };

  const handleRemoveMomAttendee = (userId: string) => {
    setMomDtplAttendees(momDtplAttendees.filter(a => a.id !== userId));
  };

  const handleCreateEvent = () => {
    if (!eventTitle || !eventDate) {
      toast.error('Please fill in required fields');
      return;
    }

    const newEvent = {
      title: eventTitle,
      type: eventType,
      date: eventDate,
      startTime: eventStartTime,
      endTime: eventEndTime,
      location: eventLocation,
      attendees: eventAttendees.map(a => a.name),
      description: eventDescription,
      project: linkedProject || undefined,
      priority: 'medium' as const,
      
    };

    dispatch(createEvent(newEvent as any))
      .unwrap()
      .then(() => {
        toast.success('Event created successfully');
        setCreateEventOpen(false);
    
        // Reset form
        setEventTitle('');
        setEventType('event');
        setEventDate('');
        setEventStartTime('');
        setEventEndTime('');
        setEventLocation('');
        setEventAttendees([]);
        setAttendeeInput('');
        setEventDescription('');
        setLinkedProject('');
      })
      .catch((err: any) => {
        toast.error(err || 'Failed to create event');
      });
  };

  const handleCreateMoM = () => {
    if (!momName || !momDate || !momAgenda) {
      toast.error('Please fill in required fields');
      return;
    }

    const newMoM = {
      meetingName: momName,
      date: momDate,
      dtplUsers: momDtplAttendees.map(a => a.name),
      externalUsers: momExternalUsers.filter(user => user.name),
      meetingType: momMeetingType,
      agenda: momAgenda,
      venue: momVenue,
      meetingLink: momMeetingLink,
      discussion: momDiscussion,
      nextMeeting: momNextMeeting || undefined
    };

    dispatch(createMoM(newMoM as any))
      .unwrap()
      .then(() => {
        toast.success('Minutes of Meeting created successfully');
        setCreateMoMOpen(false);
    
        // Reset form
        setMomName('');
        setMomDate('');
        setMomDtplAttendees([]);
        setMomAttendeeInput('');
        setMomExternalUsers([{ name: '', organization: '', designation: '' }]);
        setMomMeetingType('internal-to-customer');
        setMomAgenda('');
        setMomVenue('');
        setMomMeetingLink('');
        setMomDiscussion('');
        setMomNextMeeting('');
      })
      .catch((err: any) => {
        toast.error(err || 'Failed to create MoM');
      });
  };

  const addExternalUser = () => {
    setMomExternalUsers([...momExternalUsers, { name: '', organization: '', designation: '' }]);
  };

  const updateExternalUser = (index: number, field: string, value: string) => {
    const updated = [...momExternalUsers];
    updated[index] = { ...updated[index], [field]: value };
    setMomExternalUsers(updated);
  };

  const removeExternalUser = (index: number) => {
    if (momExternalUsers.length > 1) {
      setMomExternalUsers(momExternalUsers.filter((_, i) => i !== index));
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting':
        return '#3498db';
      case 'project':
        return '#9b59b6';
      case 'task':
        return '#f5a623';
      case 'event':
        return '#2ecc71';
      default:
        return '#6b6b6b';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <Users className="w-3 h-3" />;
      case 'project':
        return <FolderKanban className="w-3 h-3" />;
      case 'task':
        return <CheckSquare className="w-3 h-3" />;
      case 'event':
        return <CalendarIcon className="w-3 h-3" />;
      default:
        return <CalendarIcon className="w-3 h-3" />;
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days = getDaysInMonth(currentDate);
  const selectedDateEvents = getEventsForDate(selectedDate);

  return (
    <Layout user={user} currentPage="calendar" onNavigate={onNavigate} onLogout={onLogout} title="Calendar & Events">
      {loading ? (
        <CalendarSkeleton />
      ) : (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <Card className="lg:col-span-2" style={{ borderRadius: '12px' }}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" style={{ color: '#ed1c24' }} />
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="event">Events</SelectItem>
                    <SelectItem value="meeting">Meetings</SelectItem>
                    <SelectItem value="project">Projects</SelectItem>
                    <SelectItem value="task">Tasks</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Calendar Grid */}
            <div className="space-y-2">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm text-muted-foreground p-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, index) => {
                  const dayEvents = day ? getEventsForDate(day) : [];
                  const isToday = day &&
                    day.toDateString() === new Date().toDateString();
                  const isSelected = day && selectedDate &&
                    day.toDateString() === selectedDate.toDateString();

                  return (
                    <button
                      key={index}
                      onClick={() => day && setSelectedDate(day)}
                      className="min-h-[80px] p-2 rounded-lg border transition-all hover:border-primary"
                      style={{
                        backgroundColor: isSelected ? '#ed1c2410' : day ? '#ffffff' : '#f9f9f9',
                        borderColor: isToday ? '#ed1c24' : isSelected ? '#ed1c24' : 'rgba(0,0,0,0.1)',
                        borderWidth: isToday ? '2px' : '1px',
                        cursor: day ? 'pointer' : 'default'
                      }}
                      disabled={!day}
                    >
                      {day && (
                        <div className="flex flex-col items-start h-full">
                          <span className="text-sm mb-1" style={{
                            color: isToday ? '#ed1c24' : '#393738'
                          }}>
                            {day.getDate()}
                          </span>
                          <div className="space-y-1 w-full">
                            {dayEvents.slice(0, 2).map((event) => (
                              <div
                                key={event.id}
                                className="text-xs px-1 py-0.5 rounded truncate"
                                style={{
                                  backgroundColor: getEventTypeColor(event.type) + '20',
                                  color: getEventTypeColor(event.type)
                                }}
                                title={event.title}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-muted-foreground px-1">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events Panel */}
        <div className="space-y-6">
          {/* Action Buttons */}
          <Card style={{ borderRadius: '12px' }}>
            <CardContent className="p-4 space-y-3">
              <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full" style={{ backgroundColor: '#ed1c24' }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Event</DialogTitle>
                    <DialogDescription>
                      Add a new event, meeting, or link to existing projects/tasks
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="eventTitle">Event Title *</Label>
                        <Input
                          id="eventTitle"
                          value={eventTitle}
                          onChange={(e) => setEventTitle(e.target.value)}
                          placeholder="Enter event title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="eventType">Type *</Label>
                        <Select value={eventType} onValueChange={(v: string) => setEventType(v as 'event' | 'meeting')}>
                          <SelectTrigger id="eventType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="event">Event</SelectItem>
                            <SelectItem value="meeting">Meeting</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="eventDate">Date *</Label>
                        <Input
                          id="eventDate"
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="startTime">Start Time</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={eventStartTime}
                          onChange={(e) => setEventStartTime(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="endTime">End Time</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={eventEndTime}
                          onChange={(e) => setEventEndTime(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          value={eventLocation}
                          onChange={(e) => setEventLocation(e.target.value)}
                          placeholder="Meeting room, venue, etc."
                        />
                      </div>

                      <div className="space-y-2 col-span-2 relative">
                        <Label htmlFor="attendees">Attendees</Label>
                        <div className="border rounded-lg p-2 bg-white">
                          {/* Selected Attendees Tags */}
                          {eventAttendees.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {eventAttendees.map(attendee => (
                                <Badge
                                  key={attendee.id}
                                  variant="secondary"
                                  className="px-2 py-1 flex items-center gap-1"
                                >
                                  {attendee.name}
                                  <button
                                    onClick={() => handleRemoveAttendee(attendee.id)}
                                    className="ml-1 hover:text-red-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {/* Input Field */}
                          <Input
                            id="attendees"
                            value={attendeeInput}
                            onChange={(e) => handleAttendeeInputChange(e.target.value)}
                            onFocus={() => attendeeInput && setShowAttendeeDropdown(true)}
                            placeholder="Type name or email to add attendees"
                            className="border-0"
                          />
                        </div>

                        {/* Dropdown Menu */}
                        {showAttendeeDropdown && filteredUsers.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                            {filteredUsers.map(user => (
                              <button
                                key={user.id}
                                onClick={() => handleAddAttendee(user)}
                                className="w-full text-left px-3 py-2 hover:bg-slate-100 border-b last:border-b-0 transition-colors"
                              >
                                <div className="font-medium text-sm">{user.name}</div>
                                <div className="text-xs text-muted-foreground">{user.email} • {user.department}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="linkedProject">Link to Project (Optional)</Label>
                        <Select value={linkedProject} onValueChange={setLinkedProject}>
                          <SelectTrigger id="linkedProject">
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GA-2024-001">GA-2024-001 - Gear Assembly</SelectItem>
                            <SelectItem value="TS-2024-042">TS-2024-042 - Transmission Shaft</SelectItem>
                            <SelectItem value="CH-2024-018">CH-2024-018 - Clutch Housing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={eventDescription}
                          onChange={(e) => setEventDescription(e.target.value)}
                          placeholder="Event details and agenda"
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateEventOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateEvent} style={{ backgroundColor: '#ed1c24' }}>
                      Create Event
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={createMoMOpen} onOpenChange={setCreateMoMOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full" variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    Create MoM
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Minutes of Meeting</DialogTitle>
                    <DialogDescription>
                      Document meeting discussions and action items
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="momName">Meeting Title *</Label>
                        <Input
                          id="momName"
                          value={momName}
                          onChange={(e) => setMomName(e.target.value)}
                          placeholder="Enter meeting title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="momDate">Meeting Date *</Label>
                        <Input
                          id="momDate"
                          type="date"
                          value={momDate}
                          onChange={(e) => setMomDate(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nextMeeting">Next Meeting Date</Label>
                        <Input
                          id="nextMeeting"
                          type="date"
                          value={momNextMeeting}
                          onChange={(e) => setMomNextMeeting(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2 col-span-2 relative">
                        <Label htmlFor="momDtplAttendees">DTPL Attendees *</Label>
                        <div className="border rounded-lg p-2 bg-white">
                          {/* Selected Attendees Tags */}
                          {momDtplAttendees.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {momDtplAttendees.map(attendee => (
                                <Badge
                                  key={attendee.id}
                                  variant="secondary"
                                  className="px-2 py-1 flex items-center gap-1"
                                >
                                  {attendee.name}
                                  <button
                                    onClick={() => handleRemoveMomAttendee(attendee.id)}
                                    className="ml-1 hover:text-red-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {/* Input Field */}
                          <Input
                            id="momDtplAttendees"
                            value={momAttendeeInput}
                            onChange={(e) => handleMomAttendeeInputChange(e.target.value)}
                            onFocus={() => momAttendeeInput && setShowMomAttendeeDropdown(true)}
                            placeholder="Type name or email to add attendees"
                            className="border-0"
                          />
                        </div>

                        {/* Dropdown Menu */}
                        {showMomAttendeeDropdown && filteredMomUsers.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                            {filteredMomUsers.map(user => (
                              <button
                                key={user.id}
                                onClick={() => handleAddMomAttendee(user)}
                                className="w-full text-left px-3 py-2 hover:bg-slate-100 border-b last:border-b-0 transition-colors"
                              >
                                <div className="font-medium text-sm">{user.name}</div>
                                <div className="text-xs text-muted-foreground">{user.email} • {user.department}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label>External Attendees</Label>
                        <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                          {momExternalUsers.map((user, index) => (
                            <div key={index} className="grid grid-cols-12 gap-2 items-end">
                              <div className="col-span-5">
                                <Input
                                  placeholder="Name"
                                  value={user.name}
                                  onChange={(e) => updateExternalUser(index, 'name', e.target.value)}
                                />
                              </div>
                              <div className="col-span-3">
                                <Input
                                  placeholder="Organization"
                                  value={user.organization}
                                  onChange={(e) => updateExternalUser(index, 'organization', e.target.value)}
                                />
                              </div>
                              <div className="col-span-3">
                                <Input
                                  placeholder="Designation"
                                  value={user.designation}
                                  onChange={(e) => updateExternalUser(index, 'designation', e.target.value)}
                                />
                              </div>
                              <div className="col-span-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeExternalUser(index)}
                                  disabled={momExternalUsers.length === 1}
                                >
                                  <X className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={addExternalUser}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add User
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="meetingType">Meeting Type *</Label>
                        <Select value={momMeetingType} onValueChange={(value) => setMomMeetingType(value as "internal-to-customer" | "customer-to-internal" | "internal-to-supplier" | "supplier-to-internal")}>
                          <SelectTrigger id="meetingType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="internal-to-customer">Internal to Customer</SelectItem>
                            <SelectItem value="customer-to-internal">Customer to Internal</SelectItem>
                            <SelectItem value="internal-to-supplier">Internal to Supplier</SelectItem>
                            <SelectItem value="supplier-to-internal">Supplier to Internal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="agenda">Agenda *</Label>
                        <Textarea
                          id="agenda"
                          value={momAgenda}
                          onChange={(e) => setMomAgenda(e.target.value)}
                          placeholder="Meeting agenda and objectives"
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="venue">Venue</Label>
                        <Input
                          id="venue"
                          value={momVenue}
                          onChange={(e) => setMomVenue(e.target.value)}
                          placeholder="Meeting venue"
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="meetingLink">Meeting Link</Label>
                        <Input
                          id="meetingLink"
                          value={momMeetingLink}
                          onChange={(e) => setMomMeetingLink(e.target.value)}
                          placeholder="Zoom link, etc."
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="discussion">Discussion Points</Label>
                        <Textarea
                          id="discussion"
                          value={momDiscussion}
                          onChange={(e) => setMomDiscussion(e.target.value)}
                          placeholder="Key discussion points and decisions"
                          rows={4}
                        />
                      </div>


                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateMoMOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateMoM} style={{ backgroundColor: '#ed1c24' }}>
                      Save MoM
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Selected Date Events */}
          <Card style={{ borderRadius: '12px' }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                {selectedDate
                  ? `Events on ${selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                  : 'Select a date'
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {selectedDateEvents.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDateEvents.map((event) => (
                      <div
                        key={event.id}
                        className="p-3 rounded-lg border hover:shadow-md transition-shadow"
                        style={{ borderLeft: `4px solid ${getEventTypeColor(event.type)}` }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="flex-1">{event.title}</h4>
                          <Badge
                            style={{
                              backgroundColor: getEventTypeColor(event.type),
                              color: '#ffffff'
                            }}
                          >
                            {getEventTypeIcon(event.type)}
                            <span className="ml-1">{event.type}</span>
                          </Badge>
                        </div>

                        {event.startTime && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Clock className="w-3 h-3" />
                            {event.startTime} - {event.endTime}
                          </div>
                        )}

                        {event.location && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </div>
                        )}

                        {event.project && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <FolderKanban className="w-3 h-3" />
                            {event.project}
                          </div>
                        )}

                        {event.attendees && event.attendees.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Users className="w-3 h-3" />
                            {event.attendees.length} attendees
                          </div>
                        )}

                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {event.description}
                          </p>
                        )}

                        {event.type === 'meeting' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => {
                              const mom = moms.find(m => m.meetingName === event.title);
                              if (mom) {
                                setSelectedMoM(mom);
                                setViewMoMOpen(true);
                              }
                            }}
                          >
                            <FileText className="w-3 h-3 mr-2" />
                            View MoM
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No events scheduled</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* View MoM Dialog */}
      <Dialog open={viewMoMOpen} onOpenChange={setViewMoMOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Minutes of Meeting</DialogTitle>
          </DialogHeader>
          {selectedMoM && (
            <div className="space-y-6 py-4">
              <div>
                <h3 className="mb-2">{selectedMoM.meetingName}</h3>
                <p className="text-sm text-muted-foreground">
                  Date: {new Date(selectedMoM.date).toLocaleDateString('en-GB')}
                </p>
              </div>

              <div>
                <Label className="mb-2 block">DTPL Attendees</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedMoM.dtplUsers.map((attendee, idx) => (
                    <Badge key={idx} variant="outline">
                      <Users className="w-3 h-3 mr-1" />
                      {attendee}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">External Attendees</Label>
                <div className="space-y-2">
                  {selectedMoM.externalUsers.map((user, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm flex-1">{user.name}</p>
                        <Badge variant="outline" className="ml-2">
                          {user.designation} - {user.organization}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Meeting Type</Label>
                <p className="text-sm p-3 rounded-lg bg-muted/30">
                  {selectedMoM.meetingType}
                </p>
              </div>

              <div>
                <Label className="mb-2 block">Agenda</Label>
                <p className="text-sm p-3 rounded-lg bg-muted/30">
                  {selectedMoM.agenda}
                </p>
              </div>

              <div>
                <Label className="mb-2 block">Venue</Label>
                <p className="text-sm p-3 rounded-lg bg-muted/30">
                  {selectedMoM.venue}
                </p>
              </div>

              <div>
                <Label className="mb-2 block">Meeting Link</Label>
                <p className="text-sm p-3 rounded-lg bg-muted/30">
                  {selectedMoM.meetingLink}
                </p>
              </div>

              <div>
                <Label className="mb-2 block">Discussion</Label>
                <p className="text-sm p-3 rounded-lg bg-muted/30">
                  {selectedMoM.discussion}
                </p>
              </div>



              {selectedMoM.nextMeeting && (
                <div>
                  <Label className="mb-2 block">Next Meeting</Label>
                  <p className="text-sm p-3 rounded-lg bg-muted/30">
                    {new Date(selectedMoM.nextMeeting).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewMoMOpen(false)}>
              Close
            </Button>
            <Button style={{ backgroundColor: '#ed1c24' }}>
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </Layout>
  );
}