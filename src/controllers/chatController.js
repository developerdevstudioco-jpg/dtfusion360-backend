const User = require("../models/Users")
const Message = require("../models/Message")

// 🔥 CACHE
let cachedContacts = null
let lastBuildTime = 0
const CACHE_TTL = 5000

// ======================
// 🔹 RESOLVE USER
// ======================
const resolveCurrentUser = (req) => {
  const user =
    req.user?.employeeCode ||
    req.headers["x-user"] ||
    req.query.user

  if (!user) {
    console.error("❌ No user provided in request")
    return null
  }

  return user
}

// ======================
// 🔹 CONTACTS (FIXED + OPTIMIZED)
// ======================
exports.getContacts = async (req, res) => {
  try {
    console.log("\n====== GET CONTACTS ======")

    const now = Date.now()

    // 🔥 CACHE
    if (cachedContacts && now - lastBuildTime < CACHE_TTL) {
      console.log("⚡ Returning cached contacts")
      return res.json(cachedContacts)
    }

    const currentUser = resolveCurrentUser(req)

    if (!currentUser) {
      return res.status(400).json({ message: "Missing user context" })
    }

    console.log("🧠 currentUser:", currentUser)

    const users = await User.find({ isActive: true }).lean()

    console.log("👥 TOTAL USERS:", users.length)

    // 🔥 GET ALL LAST MESSAGES ONCE (OPTIMIZED)
    const allMessages = await Message.find({})
      .sort({ createdAt: -1 })
      .lean()

    const lastMessageMap = new Map()

    for (const msg of allMessages) {
      if (!lastMessageMap.has(msg.conversationId)) {
        lastMessageMap.set(msg.conversationId, msg)
      }
    }

    const conversations = []

    for (const u of users) {
      if (!u.employeeCode || u.employeeCode === currentUser) continue

      // 🔥 SAME LOGIC AS WS
      const conversationId =
        "c_" + [currentUser, u.employeeCode].sort().join("_")

      const lastMessage = lastMessageMap.get(conversationId)

      const updatedAt =
        lastMessage?.createdAt || "2000-01-01T00:00:00.000Z"

      conversations.push({
        id: conversationId,
        conversationId,
        type: "DIRECT",

        name: u.name || u.employeeCode,

        avatarUrl: u.avatarUrl || null,
        presence: u.presence || "OFFLINE",
        lastSeenAt: u.lastSeenAt || null,

        lastMessage: lastMessage
          ? {
              body: lastMessage.body,
              createdAt: lastMessage.createdAt
            }
          : null,

        unreadCount: 0,
        participantIds: [currentUser, u.employeeCode],

        updatedAt
      })
    }

    // 🔥 SORT
    conversations.sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    )

    // 🔥 CACHE SAVE
    cachedContacts = conversations
    lastBuildTime = now

    console.log(
      "✅ CONTACT IDS:",
      conversations.map(c => c.conversationId)
    )

    return res.json(conversations)

  } catch (err) {
    console.error("❌ CONTACT ERROR:", err)
    res.json([])
  }
}

// ======================
// 🔹 MESSAGES (ALIGNED WITH WS)
// ======================
exports.getMessages = async (req, res) => {
  try {
    console.log("\n====== GET MESSAGES ======")

    const { conversationId } = req.params

    const currentUser = resolveCurrentUser(req)

    if (!currentUser) {
      return res.status(400).json({ message: "Missing user context" })
    }

    console.log("🧠 currentUser:", currentUser)
    console.log("💬 conversationId:", conversationId)

    // 🔥 EXTRACT USERS FROM conversationId
    const participantsIds = conversationId.replace("c_", "").split("_")

    const users = await User.find({
      employeeCode: { $in: participantsIds }
    }).lean()

    const participants = users.map(u => ({
      id: u.employeeCode,
      name: u.name || u.employeeCode,
      avatarUrl: u.avatarUrl || null,
      presence: u.presence || "OFFLINE"
    }))

    console.log("👥 participants:", participantsIds)

    const dbMessages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .lean()

    console.log("💬 message count:", dbMessages.length)

    let messages = dbMessages

    // 🔥 LOOP FIX (REQUIRED FOR FE)
    if (messages.length === 0) {
      messages = [
        {
          _id: "init_" + conversationId,
          conversationId,
          senderId: currentUser,
          body: " ",
          createdAt: new Date(),
          status: "SENT"
        }
      ]
    }

    return res.json({
      id: conversationId,

      data: messages.map(m => ({
        id: m._id.toString(),
        conversationId: m.conversationId,
        senderId: m.senderId,
        body: m.body,
        createdAt: m.createdAt,
        status: m.status,
        deliveredTo: [],
        readBy: [],
        reactions: []
      })),

      participants
    })

  } catch (err) {
    console.error("❌ GET MESSAGES ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}

// ======================
// 🔹 MEDIA
// ======================
exports.uploadMedia = async (req, res) => {
  console.log("📎 MEDIA UPLOAD HIT")
  return res.status(200).json({ attachments: [] })
}