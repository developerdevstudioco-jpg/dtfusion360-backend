import React, { useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  Check,
  CheckCheck,
  Hash,
  Info,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smile,
  Users,
  Video,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { User, Page } from '../App';
import Layout from './Layout';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { cn } from './ui/utils';

interface MessageHubProps {
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  embedded?: boolean;
}

type ConversationKind = 'direct' | 'group' | 'project' | 'department';
type Presence = 'online' | 'away' | 'offline';
type DeliveryStatus = 'sent' | 'delivered' | 'read';

interface HubMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  timestamp: string;
  status?: DeliveryStatus;
  reactions?: Array<{ label: string; userId: string; userName: string }>;
}

interface Conversation {
  id: string;
  title: string;
  kind: ConversationKind;
  participantNames: string[];
  presence?: Presence;
  unread?: number;
  muted?: boolean;
  pinned?: boolean;
  allowedDepts?: string[];
  lastSeenAt?: string;
  messages: HubMessage[];
}

const departments = [
  'R&D',
  'NPD',
  'Quality Assurance (QA)',
  'Production',
  'Manufacturing Engineering',
  'Maintenance',
  'Purchase',
  'Stores / Inventory',
  'Logistics',
  'Sales',
  'Finance & Accounts',
  'HR',
  'IT / Systems',
  'Administration',
  'Admin / Management Office',
];

const defaultConversations: Conversation[] = [
  {
    id: 'ops-direct',
    title: 'Operations Desk',
    kind: 'direct',
    participantNames: ['Operations Desk', 'Priya Desai'],
    presence: 'online',
    unread: 2,
    pinned: true,
    messages: [
      {
        id: 'm1',
        conversationId: 'ops-direct',
        senderId: 'system-demo-1',
        senderName: 'Operations Desk',
        senderRole: 'Coordinator',
        body: 'Daily APQP review notes are available. Please keep blockers updated before the 4 PM review.',
        timestamp: '2026-06-03T09:15:00.000Z',
        status: 'read',
      },
      {
        id: 'm2',
        conversationId: 'ops-direct',
        senderId: 'demo-user',
        senderName: 'Priya Desai',
        senderRole: 'Manager',
        body: 'Got it. I will update the open tooling point after the supplier call.',
        timestamp: '2026-06-03T09:18:00.000Z',
        status: 'read',
      },
    ],
  },
  {
    id: 'project-updates',
    title: 'Project Updates',
    kind: 'project',
    participantNames: ['Rahul Sharma', 'Amit Patel', 'Priya Desai', 'Operations Desk'],
    unread: 1,
    messages: [
      {
        id: 'm3',
        conversationId: 'project-updates',
        senderId: 'system-demo-2',
        senderName: 'Rahul Sharma',
        senderRole: 'Engineer',
        body: 'Tooling validation is ready for QA review. I have attached the checklist reference in the project file area.',
        timestamp: '2026-06-03T08:40:00.000Z',
      },
      {
        id: 'm4',
        conversationId: 'project-updates',
        senderId: 'system-demo-3',
        senderName: 'Amit Patel',
        senderRole: 'QA',
        body: 'QA will review it before lunch and share observations here.',
        timestamp: '2026-06-03T08:52:00.000Z',
      },
    ],
  },
  {
    id: 'qa-team',
    title: 'Quality Assurance',
    kind: 'department',
    participantNames: ['Amit Patel', 'Neha Shah', 'Operations Desk'],
    allowedDepts: ['Quality Assurance (QA)'],
    messages: [
      {
        id: 'm5',
        conversationId: 'qa-team',
        senderId: 'system-demo-3',
        senderName: 'Amit Patel',
        senderRole: 'QA',
        body: 'Incoming inspection summary is clean. Two minor observations need owner confirmation.',
        timestamp: '2026-06-02T16:20:00.000Z',
      },
    ],
  },
  {
    id: 'general',
    title: 'General',
    kind: 'group',
    participantNames: ['All departments'],
    muted: true,
    messages: [
      {
        id: 'm6',
        conversationId: 'general',
        senderId: 'system-demo-4',
        senderName: 'Admin Office',
        senderRole: 'Admin',
        body: 'Reminder: update weekly progress and pending MOM actions before end of day.',
        timestamp: '2026-06-02T10:10:00.000Z',
      },
    ],
  },
];

const kindMeta: Record<ConversationKind, { label: string; icon: React.ElementType; tone: string; avatar: string }> = {
  direct: {
    label: 'Direct',
    icon: MessageCircle,
    tone: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    avatar: 'bg-emerald-600 text-white',
  },
  group: {
    label: 'Group',
    icon: Users,
    tone: 'text-slate-700 bg-slate-100 border-slate-200',
    avatar: 'bg-slate-800 text-white',
  },
  project: {
    label: 'Project',
    icon: Building2,
    tone: 'text-blue-700 bg-blue-50 border-blue-100',
    avatar: 'bg-blue-600 text-white',
  },
  department: {
    label: 'Department',
    icon: Hash,
    tone: 'text-violet-700 bg-violet-50 border-violet-100',
    avatar: 'bg-violet-600 text-white',
  },
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatConversationTime(timestamp?: string) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMessageTime(timestamp?: string) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getLastMessage(conversation: Conversation) {
  return conversation.messages[conversation.messages.length - 1];
}

function getLastMessageTime(conversation: Conversation) {
  return getLastMessage(conversation)?.timestamp ?? '';
}

function getPresenceText(conversation: Conversation) {
  if (conversation.kind !== 'direct') {
    return `${conversation.participantNames.length} participants`;
  }

  if (conversation.presence === 'online') return 'Online';
  if (conversation.presence === 'away') return 'Away';
  return conversation.lastSeenAt ? `Last seen ${formatConversationTime(conversation.lastSeenAt)}` : 'Offline';
}

function getStatusIcon(status?: DeliveryStatus) {
  if (status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-[#34b7f1]" />;
  if (status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-slate-400" />;
  if (status === 'sent') return <Check className="h-3.5 w-3.5 text-slate-400" />;
  return null;
}

export default function MessageHub({ user, onNavigate, onLogout, embedded = false }: MessageHubProps) {
  const [conversations, setConversations] = useState<Conversation[]>(defaultConversations);
  const [selectedConversationId, setSelectedConversationId] = useState(defaultConversations[0]?.id ?? '');
  const [messageInput, setMessageInput] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [isCreateConversationOpen, setIsCreateConversationOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(true);
  const [newConversationData, setNewConversationData] = useState({
    title: '',
    kind: 'group' as ConversationKind,
    participants: '',
    allowedDepts: [] as string[],
  });

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0] ?? null;

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();

    return [...conversations]
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(getLastMessageTime(b)).getTime() - new Date(getLastMessageTime(a)).getTime();
      })
      .filter((conversation) => {
        if (!query) return true;

        return (
          conversation.title.toLowerCase().includes(query) ||
          conversation.kind.toLowerCase().includes(query) ||
          conversation.participantNames.some((name) => name.toLowerCase().includes(query))
        );
      });
  }, [conversationSearch, conversations]);

  const totalUnread = conversations.reduce((total, conversation) => total + (conversation.unread || 0), 0);
  const selectedMeta = selectedConversation ? kindMeta[selectedConversation.kind] : kindMeta.group;
  const SelectedIcon = selectedMeta.icon;

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread: 0 } : conversation,
      ),
    );
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation) return;

    const newMessage: HubMessage = {
      id: `${Date.now()}`,
      conversationId: selectedConversation.id,
      senderId: user.id,
      senderName: user.name || 'You',
      senderRole: user.role,
      body: messageInput.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent',
    };

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, messages: [...conversation.messages, newMessage], unread: 0 }
          : conversation,
      ),
    );
    setMessageInput('');
    toast.success('Message sent');
  };

  const handleReaction = (messageId: string, label: string) => {
    if (!selectedConversation) return;

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      reactions: message.reactions
                        ? [...message.reactions, { label, userId: user.id, userName: user.name }]
                        : [{ label, userId: user.id, userName: user.name }],
                    }
                  : message,
              ),
            }
          : conversation,
      ),
    );
  };

  const handleCreateConversation = () => {
    const title = newConversationData.title.trim();

    if (!title) {
      toast.error('Conversation name is required');
      return;
    }

    const participantNames = newConversationData.participants
      .split(',')
      .map((participant) => participant.trim())
      .filter(Boolean);

    const newConversation: Conversation = {
      id: `${Date.now()}`,
      title,
      kind: newConversationData.kind,
      participantNames: participantNames.length ? participantNames : [user.name],
      allowedDepts: newConversationData.kind === 'department' ? newConversationData.allowedDepts : undefined,
      presence: newConversationData.kind === 'direct' ? 'offline' : undefined,
      unread: 0,
      messages: [],
    };

    setConversations((prev) => [newConversation, ...prev]);
    setSelectedConversationId(newConversation.id);
    setNewConversationData({ title: '', kind: 'group', participants: '', allowedDepts: [] });
    setIsCreateConversationOpen(false);
    toast.success('Conversation created');
  };

  const toggleDepartment = (department: string) => {
    setNewConversationData((prev) => ({
      ...prev,
      allowedDepts: prev.allowedDepts.includes(department)
        ? prev.allowedDepts.filter((item) => item !== department)
        : [...prev.allowedDepts, department],
    }));
  };

  const refreshConversations = () => {
    toast.success('Messages refreshed');
  };

  const Content = (
    <div
      className={cn(
        'grid min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm',
        embedded
          ? 'h-full grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]'
          : 'h-[calc(100vh-190px)] grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)_300px]',
      )}
    >
      <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-[#f7f8f5]">
        <div className="shrink-0 border-b border-slate-200 bg-[#075e54] p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold leading-tight">MessageHub</h2>
              <p className="mt-1 text-xs text-white/75">
                {totalUnread > 0 ? `${totalUnread} unread messages` : 'All conversations are up to date'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshConversations}
                className="h-9 w-9 rounded-full text-white hover:bg-white/10 hover:text-white"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                onClick={() => setIsCreateConversationOpen(true)}
                className="h-9 w-9 rounded-full bg-white text-[#075e54] hover:bg-white/90"
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-white/70" />
            <Input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search or start new chat"
              className="h-9 rounded-full border-white/10 bg-white/15 pl-9 text-white placeholder:text-white/70 focus-visible:ring-white/30"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="py-2">
            {filteredConversations.length === 0 ? (
              <div className="m-4 rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No conversations found
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const meta = kindMeta[conversation.kind];
                const lastMessage = getLastMessage(conversation);
                const isActive = selectedConversation?.id === conversation.id;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={cn(
                      'flex w-full items-center gap-3 border-l-4 px-3 py-3 text-left transition-colors',
                      isActive ? 'border-[#25d366] bg-white' : 'border-transparent hover:bg-white/80',
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 border border-white shadow-sm">
                        <AvatarFallback className={cn('font-semibold', meta.avatar)}>
                          {getInitials(conversation.title)}
                        </AvatarFallback>
                      </Avatar>
                      {conversation.presence === 'online' && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#25d366] ring-2 ring-white" />
                      )}
                      {conversation.pinned && (
                        <span className="absolute -left-1 -top-1 rounded-full bg-[#075e54] px-1 text-[9px] font-bold text-white">
                          PIN
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-slate-900">{conversation.title}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{getPresenceText(conversation)}</p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-slate-500">
                          {formatConversationTime(lastMessage?.timestamp)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <p
                          className={cn(
                            'min-w-0 flex-1 truncate text-sm',
                            conversation.unread ? 'font-medium text-slate-900' : 'text-slate-500',
                          )}
                        >
                          {lastMessage?.body ?? 'No messages yet'}
                        </p>
                        {conversation.unread ? (
                          <Badge className="h-5 min-w-5 justify-center rounded-full bg-[#25d366] px-1.5 text-[10px] text-white">
                            {conversation.unread}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </aside>

      <section className="flex min-h-0 flex-col bg-[#efeae2]">
        {selectedConversation ? (
          <>
            <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-[#f0f2f5] px-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-10 w-10 border border-white shadow-sm">
                  <AvatarFallback className={cn('font-semibold', selectedMeta.avatar)}>
                    {getInitials(selectedConversation.title)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-slate-950">{selectedConversation.title}</h3>
                    <Badge variant="outline" className={cn('hidden rounded-full border px-2 text-[10px] sm:inline-flex', selectedMeta.tone)}>
                      {selectedMeta.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{getPresenceText(selectedConversation)}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-slate-600">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <Video className="h-4 w-4" />
                </Button>
                {!embedded && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsInfoOpen((value) => !value)}
                    className="h-9 w-9 rounded-full"
                  >
                    {isInfoOpen ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-4">
                <div className="flex justify-center">
                  <span className="rounded-md bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
                    Today
                  </span>
                </div>

                {selectedConversation.messages.length === 0 ? (
                  <div className="flex min-h-[360px] items-center justify-center">
                    <div className="rounded-md bg-white/80 p-6 text-center shadow-sm">
                      <MessageCircle className="mx-auto h-8 w-8 text-slate-400" />
                      <h4 className="mt-3 text-sm font-semibold text-slate-900">No messages yet</h4>
                      <p className="mt-1 text-sm text-slate-500">Start the first conversation here.</p>
                    </div>
                  </div>
                ) : (
                  selectedConversation.messages.map((message) => {
                    const isCurrentUser = message.senderId === user.id;

                    return (
                      <article
                        key={message.id}
                        className={cn('group flex w-full', isCurrentUser ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[78%] rounded-lg px-3 py-2 shadow-sm',
                            isCurrentUser
                              ? 'rounded-tr-sm bg-[#dcf8c6] text-slate-950'
                              : 'rounded-tl-sm bg-white text-slate-950',
                          )}
                        >
                          {!isCurrentUser && selectedConversation.kind !== 'direct' && (
                            <p className="mb-1 text-xs font-semibold text-[#075e54]">{message.senderName}</p>
                          )}
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                          <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-500">
                            <span>{formatMessageTime(message.timestamp)}</span>
                            {isCurrentUser && getStatusIcon(message.status)}
                          </div>

                          <div className="mt-1 flex min-h-5 flex-wrap justify-end gap-1">
                            {(message.reactions || []).map((reaction, index) => (
                              <span
                                key={`${reaction.label}-${index}`}
                                className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700"
                              >
                                {reaction.label}
                              </span>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleReaction(message.id, 'Like')}
                              className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-500 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                            >
                              Like
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <footer className="shrink-0 border-t border-slate-200 bg-[#f0f2f5] p-3">
              <div className="mx-auto flex max-w-4xl items-end gap-2">
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full text-slate-600">
                  <Smile className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full text-slate-600">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Textarea
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={`Message ${selectedConversation.title}`}
                  rows={1}
                  className="max-h-28 min-h-10 resize-none rounded-2xl border-none bg-white px-4 py-2.5 shadow-sm focus-visible:ring-[#25d366]"
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="h-10 w-10 shrink-0 rounded-full bg-[#25d366] text-white hover:bg-[#1fb456]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-slate-500">
            <div>
              <MessageCircle className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm">Select a conversation to start messaging.</p>
            </div>
          </div>
        )}
      </section>

      {!embedded && isInfoOpen && selectedConversation && (
        <aside className="hidden min-h-0 flex-col border-l border-slate-200 bg-white lg:flex">
          <div className="border-b border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-950">Conversation Info</h3>
            <p className="mt-1 text-xs text-slate-500">People, access and activity</p>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-4">
              <div className="rounded-md border border-slate-200 p-4 text-center">
                <Avatar className="mx-auto h-16 w-16 border border-white shadow-sm">
                  <AvatarFallback className={cn('text-lg font-semibold', selectedMeta.avatar)}>
                    {getInitials(selectedConversation.title)}
                  </AvatarFallback>
                </Avatar>
                <h4 className="mt-3 text-sm font-semibold text-slate-950">{selectedConversation.title}</h4>
                <p className="mt-1 text-xs text-slate-500">{getPresenceText(selectedConversation)}</p>
              </div>

              <div className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <SelectedIcon className="h-4 w-4 text-[#075e54]" />
                  Type
                </div>
                <Badge variant="outline" className={cn('mt-3 rounded-full border px-2 capitalize', selectedMeta.tone)}>
                  {selectedMeta.label}
                </Badge>
              </div>

              <div className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4 text-slate-500" />
                  Participants
                </div>
                <div className="mt-3 space-y-2">
                  {selectedConversation.participantNames.map((participant) => (
                    <div key={participant} className="flex items-center gap-2 text-sm text-slate-700">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-slate-100 text-[10px] text-slate-700">
                          {getInitials(participant)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{participant}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Bell className="h-4 w-4 text-slate-500" />
                  Notifications
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {selectedConversation.muted ? 'Muted for this conversation' : 'Enabled for this conversation'}
                </p>
              </div>

              <div className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Info className="h-4 w-4 text-slate-500" />
                  Access
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(selectedConversation.allowedDepts?.length
                    ? selectedConversation.allowedDepts
                    : ['All departments']
                  ).map((department) => (
                    <Badge key={department} variant="secondary" className="rounded-full px-2 py-1 text-[11px]">
                      {department}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>
      )}
    </div>
  );

  return (
    <>
      {embedded ? (
        Content
      ) : (
        <Layout user={user} currentPage="messages" onNavigate={onNavigate} onLogout={onLogout} title="MessageHub">
          {Content}
        </Layout>
      )}

      <Dialog open={isCreateConversationOpen} onOpenChange={setIsCreateConversationOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>Create a direct chat, group, project channel, or department space.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="conversation-title">Name *</Label>
              <Input
                id="conversation-title"
                placeholder="e.g., Rahul Sharma, Project Phoenix, QA Team"
                value={newConversationData.title}
                onChange={(event) => setNewConversationData((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conversation-kind">Type *</Label>
              <Select
                value={newConversationData.kind}
                onValueChange={(value: ConversationKind) =>
                  setNewConversationData((prev) => ({ ...prev, kind: value }))
                }
              >
                <SelectTrigger id="conversation-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conversation-participants">Participants</Label>
              <Input
                id="conversation-participants"
                placeholder="Comma separated names"
                value={newConversationData.participants}
                onChange={(event) => setNewConversationData((prev) => ({ ...prev, participants: event.target.value }))}
              />
            </div>

            {newConversationData.kind === 'department' && (
              <div className="space-y-2">
                <Label>Allowed Departments</Label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                  {departments.map((department) => (
                    <div key={department} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dept-${department}`}
                        checked={newConversationData.allowedDepts.includes(department)}
                        onCheckedChange={() => toggleDepartment(department)}
                      />
                      <label htmlFor={`dept-${department}`} className="cursor-pointer text-sm">
                        {department}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Leave empty to allow all departments.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateConversationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConversation} className="bg-[#075e54] text-white hover:bg-[#064e46]">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
