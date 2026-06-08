// =============================================================================
// Mock seed data for chat module.
// =============================================================================
import type { Conversation, Message, User } from "../types";

export const CURRENT_USER_ID = "u_me";

const now = Date.now();
const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

export const mockUsers: User[] = [
  {
    id: CURRENT_USER_ID,
    name: "You",
    avatarUrl: undefined,
    email: "you@example.com",
    mobile: "+91 98765 43210",
    role: "Plant Admin",
    department: "Engineering",
    plant: "Aurangabad Plant 1",
    location: "Aurangabad",
    presence: "ONLINE",
  },
  {
    id: "u_alice",
    name: "Alice Carter",
    email: "alice.carter@company.com",
    mobile: "+91 91234 56789",
    role: "QA",
    department: "Quality",
    plant: "Pune Plant",
    location: "Pune",
    presence: "ONLINE",
    lastSeenAt: iso(0),
  },
  {
    id: "u_bob",
    name: "Bob Kim",
    email: "bob.kim@company.com",
    mobile: "+91 99876 54321",
    role: "Operator",
    department: "Production",
    plant: "Aurangabad Plant 1",
    location: "Aurangabad",
    presence: "AWAY",
    lastSeenAt: iso(60_000 * 5),
  },
  {
    id: "u_chris",
    name: "Chris Patel",
    email: "chris.patel@company.com",
    mobile: "+91 90123 45678",
    role: "Department Manager",
    department: "Research",
    plant: "Nashik Plant",
    location: "Nashik",
    presence: "OFFLINE",
    lastSeenAt: iso(60_000 * 60 * 2),
  },
  {
    id: "u_dana",
    name: "Dana Liu",
    email: "dana.liu@company.com",
    mobile: "+91 93456 78901",
    role: "Super Admin",
    department: "Operations",
    plant: "Pune Plant",
    location: "Pune",
    presence: "ONLINE",
    lastSeenAt: iso(0),
  },
  {
    id: "u_eve",
    name: "Eve Martinez",
    email: "eve.martinez@company.com",
    mobile: "+91 92345 67890",
    role: "Assistant Manager",
    department: "Maintenance",
    plant: "Nashik Plant",
    location: "Nashik",
    presence: "OFFLINE",
    lastSeenAt: iso(60_000 * 60 * 24),
  },
];

const mkMsg = (
  id: string,
  conversationId: string,
  senderId: string,
  body: string,
  ageMs: number,
): Message => ({
  id,
  conversationId,
  senderId,
  body,
  attachments: [],
  reactions: [],
  status: "READ",
  createdAt: iso(ageMs),
  updatedAt: iso(ageMs),
  deliveredTo: [],
  readBy: [],
});

export const mockMessages: Record<string, Message[]> = {
  c_1: [
    mkMsg("m_1_1", "c_1", "u_alice", "Hey! Are we still on for the design review?", 60_000 * 60),
    mkMsg("m_1_2", "c_1", CURRENT_USER_ID, "Yep, 3pm works. I'll send the Figma link.", 60_000 * 55),
    mkMsg("m_1_3", "c_1", "u_alice", "Perfect, thanks 🙌", 60_000 * 50),
  ],
  c_2: [
    mkMsg("m_2_1", "c_2", "u_bob", "Pushed the API contract changes.", 60_000 * 60 * 3),
    mkMsg("m_2_2", "c_2", CURRENT_USER_ID, "Reviewing now.", 60_000 * 60 * 2.5),
  ],
  c_3: [
    mkMsg("m_3_1", "c_3", "u_dana", "Welcome to the launch room 🚀", 60_000 * 60 * 24),
    mkMsg("m_3_2", "c_3", "u_chris", "Schedule attached.", 60_000 * 60 * 23),
    mkMsg("m_3_3", "c_3", CURRENT_USER_ID, "Thanks team!", 60_000 * 60 * 22),
  ],
  c_4: [
    mkMsg("m_4_1", "c_4", "u_eve", "Quick question about the report.", 60_000 * 60 * 48),
  ],
};

export const mockConversations: Conversation[] = [
  {
    id: "c_1",
    type: "DIRECT",
    participantIds: [CURRENT_USER_ID, "u_alice"],
    unreadCount: 0,
    createdAt: iso(60_000 * 60 * 24 * 7),
    updatedAt: iso(60_000 * 50),
    lastMessage: mockMessages.c_1[mockMessages.c_1.length - 1],
  },
  {
    id: "c_2",
    type: "DIRECT",
    participantIds: [CURRENT_USER_ID, "u_bob"],
    unreadCount: 1,
    createdAt: iso(60_000 * 60 * 24 * 14),
    updatedAt: iso(60_000 * 60 * 2.5),
    lastMessage: mockMessages.c_2[mockMessages.c_2.length - 1],
  },
  {
    id: "c_3",
    type: "GROUP",
    title: "Launch Squad",
    participantIds: [CURRENT_USER_ID, "u_dana", "u_chris", "u_alice"],
    unreadCount: 0,
    createdAt: iso(60_000 * 60 * 24 * 30),
    updatedAt: iso(60_000 * 60 * 22),
    lastMessage: mockMessages.c_3[mockMessages.c_3.length - 1],
    isPinned: true,
  },
  {
    id: "c_4",
    type: "DIRECT",
    participantIds: [CURRENT_USER_ID, "u_eve"],
    unreadCount: 1,
    createdAt: iso(60_000 * 60 * 24 * 60),
    updatedAt: iso(60_000 * 60 * 48),
    lastMessage: mockMessages.c_4[mockMessages.c_4.length - 1],
  },
];
