const WebSocket = require("ws")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")
const User = require("../models/Users")
const Conversation = require("../models/Conversation")
const Message = require("../models/Message")
const MessageAttachment = require("../models/MessageAttachment")
const MessageAuditLog = require("../models/MessageAuditLog")

const clients = new Map()
const REACTIONS = new Set(["👍", "✅", "👌", "🙏", "👏", "🎯", "⚠️", "❓", "👀", "📌"])

const sanitizeText = (value) => String(value || "").replace(/[<>]/g, "").trim().slice(0, 10000)
const directParticipants = (id) => /^c_[^_]+_[^_]+$/.test(id) ? id.slice(2).split("_") : []

function parseFrame(raw) {
  const value = raw.toString().replace(/\0+$/, "")
  if (!value.trim()) return { command: "HEARTBEAT", headers: {}, body: "" }
  const separator = value.indexOf("\n\n")
  const head = separator >= 0 ? value.slice(0, separator) : value
  const lines = head.replace(/\r/g, "").split("\n")
  const command = lines.shift()?.trim().toUpperCase()
  const headers = Object.fromEntries(lines.filter((line) => line.includes(":")) .map((line) => {
    const index = line.indexOf(":")
    return [line.slice(0, index), line.slice(index + 1)]
  }))
  return { command, headers, body: separator >= 0 ? value.slice(separator + 2) : "" }
}

function sendFrame(ws, command, headers = {}, body = "") {
  if (ws.readyState !== WebSocket.OPEN) return
  const content = typeof body === "string" ? body : JSON.stringify(body)
  const headerText = Object.entries(headers).map(([key, value]) => `${key}:${value}`).join("\n")
  ws.send(`${command}\n${headerText}${headerText ? "\n" : ""}content-length:${Buffer.byteLength(content)}\n\n${content}\0`)
}

function sendError(ws, message) {
  sendFrame(ws, "ERROR", { message }, JSON.stringify({ message }))
}

function eventFrame(userId, event) {
  const sockets = clients.get(userId)
  if (!sockets) return
  sockets.forEach((ws) => {
    ws.subscriptions.forEach((destination, subscriptionId) => {
      const matchesUserQueue = destination === "/user/queue/events"
      const matchesTopic = destination === `/topic/messages/${event.payload?.conversationId}`
      const matchesPresence = destination === "/topic/presence" && event.type === "PRESENCE_UPDATE"
      if (matchesUserQueue || matchesTopic || matchesPresence) {
        sendFrame(ws, "MESSAGE", { subscription: subscriptionId, destination, "message-id": `${Date.now()}-${Math.random()}`, "content-type": "application/json" }, event)
      }
    })
  })
}

// REST chat mutations use the same per-user event stream as STOMP sends.
// Keeping this broadcaster here ensures a message is delivered immediately
// regardless of which supported transport was used to create it.
function publishChatEvent(userIds, event) {
  [...new Set((userIds || []).filter(Boolean))].forEach((userId) => {
    try {
      eventFrame(userId, event)
    } catch (error) {
      console.error("Chat realtime publish error:", error.message)
    }
  })
}

function broadcastChatEvent(event) {
  publishChatEvent([...clients.keys()], event)
}

async function participantIds(conversationId, userId) {
  const direct = directParticipants(conversationId)
  if (direct.length) return direct.includes(userId) ? direct : []
  if (!mongoose.isValidObjectId(conversationId)) return []
  const conversation = await Conversation.findById(conversationId).lean()
  if (!conversation?.participants?.includes(userId) || conversation.status === "ARCHIVED") return []
  const membership = conversation.members?.find((member) => member.userId === userId)
  if (membership?.role === "READ_ONLY") return []
  return conversation.participants
}

function attachmentDto(item) {
  return { id: item.attachmentId, attachmentId: item.attachmentId, kind: item.mimeType?.startsWith("image/") ? "IMAGE" : "FILE", name: item.fileName, fileName: item.fileName, fileExtension: item.fileExtension, mimeType: item.mimeType, size: item.fileSize, fileSize: item.fileSize, uploadedBy: item.uploadedBy, uploadedAt: item.uploadedAt, securityScanStatus: item.securityScanStatus, url: `/api/chat/attachments/${item.attachmentId}/download` }
}

function messageDto(message) {
  return {
    id: String(message._id), clientId: message.clientId, conversationId: message.conversationId,
    senderId: message.senderId, body: message.deletedAt ? "Message deleted" : message.body,
    attachments: (message.attachments || []).map(attachmentDto),
    reactions: Object.values((message.reactions || []).reduce((groups, item) => { groups[item.reaction] ||= { emoji: item.reaction, userIds: [] }; groups[item.reaction].userIds.push(item.userId); return groups }, {})),
    status: message.status || "SENT", createdAt: message.createdAt, updatedAt: message.updatedAt || message.createdAt,
    replyToId: message.parentMessageId, editedAt: message.editedAt, deletedAt: message.deletedAt,
    deliveredTo: message.deliveredTo || [], readBy: message.readBy || [],
  }
}

async function authenticate(headers) {
  const rawToken = headers.Authorization || headers.authorization || ""
  const token = rawToken.startsWith("Bearer ") ? rawToken.slice(7) : rawToken
  if (!token) return null
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey")
  const user = await User.findById(decoded.id).select("employeeCode name role isActive").lean()
  return user?.isActive !== false ? user : null
}

async function handleSend(ws, frame) {
  let data
  try { data = JSON.parse(frame.body || "{}") } catch { return sendError(ws, "Invalid JSON payload") }
  const destination = frame.headers.destination
  const userId = ws.user.employeeCode

  if (destination === "/app/chat.send") {
    const conversationId = data.conversationId || (data.to ? `c_${[userId, data.to].sort().join("_")}` : null)
    if (!conversationId) return sendError(ws, "conversationId is required")
    const participants = await participantIds(conversationId, userId)
    if (!participants.length) return sendError(ws, "Conversation access denied or read-only")
    if (mongoose.isValidObjectId(conversationId)) {
      const channel = await Conversation.findById(conversationId).lean()
      const membership = channel?.members?.find((member) => member.userId === userId)
      const elevated = ["SuperAdmin", "PlantAdmin", "Admin", "Management", "Messaging Admin"].includes(ws.user.role)
      if (channel?.isAnnouncement && !elevated && !["OWNER", "ADMIN"].includes(membership?.role)) return sendError(ws, "Only channel administrators can post announcements")
    }
    if (data.clientId) {
      const duplicate = await Message.findOne({ clientId: data.clientId, senderId: userId }).lean()
      if (duplicate) return eventFrame(userId, { type: "MESSAGE_ACK", ts: new Date().toISOString(), payload: { clientId: data.clientId, message: messageDto(duplicate) } })
    }
    const attachmentIds = (data.attachments || []).map((item) => item.attachmentId || item.id).filter(Boolean).slice(0, 10)
    const uploads = attachmentIds.length ? await MessageAttachment.find({ attachmentId: { $in: attachmentIds }, uploadedBy: userId }).select("+storagePath").lean() : []
    const attachments = uploads.map((item) => ({ attachmentId: item.attachmentId, fileName: item.fileName, fileExtension: item.fileExtension, mimeType: item.mimeType, fileSize: item.fileSize, storagePath: item.storagePath, uploadedBy: item.uploadedBy, uploadedAt: item.uploadedAt, securityScanStatus: item.securityScanStatus }))
    const body = sanitizeText(data.body ?? data.message)
    if (!body && !attachments.length) return sendError(ws, "Message cannot be empty")
    const saved = await Message.create({ conversationId, senderId: userId, clientId: data.clientId || null, body, parentMessageId: data.replyToId || null, messageType: attachments.length ? "FILE" : "TEXT", attachments, mentions: [...new Set(Array.from(body.matchAll(/@([A-Za-z0-9._-]+)/g), (match) => match[1]))] })
    if (attachmentIds.length) await MessageAttachment.updateMany({ attachmentId: { $in: attachmentIds } }, { messageId: String(saved._id), conversationId })
    const message = messageDto(saved.toObject())
    if (mongoose.isValidObjectId(conversationId)) await Conversation.updateOne({ _id: conversationId }, { lastMessage: { body: body || `Attachment: ${attachments[0]?.fileName}`, senderId: userId, createdAt: saved.createdAt }, updatedAt: saved.createdAt })
    await MessageAuditLog.create({ messageId: String(saved._id), conversationId, action: "MESSAGE_CREATED", performedBy: userId, newValue: { body, attachmentIds } })
    eventFrame(userId, { type: "MESSAGE_ACK", ts: new Date().toISOString(), payload: { clientId: data.clientId, message } })
    participants.forEach((participantId) => eventFrame(participantId, { type: "MESSAGE_NEW", ts: new Date().toISOString(), payload: message }))
    return
  }

  if (destination === "/app/chat.typing") {
    const participants = await participantIds(data.conversationId, userId)
    participants.filter((id) => id !== userId).forEach((id) => eventFrame(id, { type: data.typing ? "TYPING_START" : "TYPING_STOP", ts: new Date().toISOString(), payload: { conversationId: data.conversationId, userId } }))
    return
  }

  if (destination === "/app/chat.read") {
    const participants = await participantIds(data.conversationId, userId)
    if (!participants.length) return
    await Message.updateMany({ conversationId: data.conversationId, readBy: { $ne: userId } }, { $addToSet: { readBy: userId }, $set: { status: "READ" } })
    participants.forEach((id) => eventFrame(id, { type: "MESSAGE_READ", ts: new Date().toISOString(), payload: { conversationId: data.conversationId, userId, upToMessageId: data.upToMessageId, readAt: new Date().toISOString() } }))
    return
  }

  if (destination === "/app/chat.reaction") {
    if (!REACTIONS.has(data.emoji)) return sendError(ws, "Unsupported reaction")
    const message = await Message.findById(data.messageId)
    if (!message || !(await participantIds(message.conversationId, userId)).length) return sendError(ws, "Message not found")
    const index = message.reactions.findIndex((item) => item.userId === userId && item.reaction === data.emoji)
    const removed = index >= 0
    removed ? message.reactions.splice(index, 1) : message.reactions.push({ userId, reaction: data.emoji })
    await message.save()
    const recipients = await participantIds(message.conversationId, userId)
    recipients.forEach((id) => eventFrame(id, { type: removed ? "REACTION_REMOVED" : "REACTION_ADDED", ts: new Date().toISOString(), payload: { conversationId: message.conversationId, messageId: String(message._id), emoji: data.emoji, userId } }))
  }
}

const initWebSocket = (server) => {
  // Clear presence left behind by an unclean server shutdown. Connected users
  // are marked online again as soon as their authenticated socket opens.
  void User.updateMany({}, { $set: { presence: "OFFLINE" } }).catch((error) => {
    console.error("Unable to reset chat presence:", error.message)
  })
  const wss = new WebSocket.Server({ server })
  wss.on("connection", (ws) => {
    ws.subscriptions = new Map()
    ws.isAlive = true
    ws.on("pong", () => { ws.isAlive = true })
    ws.on("message", async (raw) => {
      try {
        const frame = parseFrame(raw)
        if (frame.command === "HEARTBEAT") return
        if (frame.command === "CONNECT" || frame.command === "STOMP") {
          const user = await authenticate(frame.headers)
          if (!user) { sendError(ws, "Authentication failed"); return ws.close(1008, "Authentication failed") }
          ws.user = user
          const sockets = clients.get(user.employeeCode) || new Set()
          sockets.add(ws); clients.set(user.employeeCode, sockets)
          await User.updateOne({ employeeCode: user.employeeCode }, { $set: { presence: "ONLINE" } })
          sendFrame(ws, "CONNECTED", { version: "1.2", "heart-beat": "10000,10000", session: `${Date.now()}` })
          broadcastChatEvent({ type: "PRESENCE_UPDATE", ts: new Date().toISOString(), payload: { userId: user.employeeCode, status: "ONLINE" } })
          return
        }
        if (!ws.user) return sendError(ws, "Connect before sending frames")
        if (frame.command === "SUBSCRIBE") {
          const subscriptionId = frame.headers.id || `${Date.now()}`
          const destination = frame.headers.destination
          ws.subscriptions.set(subscriptionId, destination)
          if (destination === "/user/queue/events" || destination === "/topic/presence") {
            const ts = new Date().toISOString()
            clients.forEach((_sockets, onlineUserId) => {
              sendFrame(ws, "MESSAGE", { subscription: subscriptionId, destination, "message-id": `${Date.now()}-${Math.random()}`, "content-type": "application/json" }, { type: "PRESENCE_UPDATE", ts, payload: { userId: onlineUserId, status: "ONLINE" } })
            })
          }
        }
        else if (frame.command === "UNSUBSCRIBE") ws.subscriptions.delete(frame.headers.id)
        else if (frame.command === "SEND") await handleSend(ws, frame)
        else if (frame.command === "DISCONNECT") ws.close(1000, "Client disconnected")
      } catch (error) {
        console.error("Chat WebSocket error:", error)
        sendError(ws, error.message || "Realtime operation failed")
      }
    })
    ws.on("close", async () => {
      const userId = ws.user?.employeeCode
      if (!userId) return
      const sockets = clients.get(userId)
      sockets?.delete(ws)
      if (!sockets?.size) {
        clients.delete(userId)
        setTimeout(async () => {
          if (clients.has(userId)) return
          const lastSeenAt = new Date().toISOString()
          try {
            await User.updateOne({ employeeCode: userId }, { $set: { presence: "OFFLINE", lastSeenAt } })
          } catch (error) {
            console.error("Unable to update offline presence:", error.message)
          }
          broadcastChatEvent({ type: "PRESENCE_UPDATE", ts: lastSeenAt, payload: { userId, status: "OFFLINE", lastSeenAt } })
        }, 1000)
      }
    })
  })

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate()
      ws.isAlive = false
      ws.ping()
    })
  }, 30000)
  wss.on("close", () => clearInterval(heartbeat))
  return wss
}

module.exports = initWebSocket
module.exports.publishChatEvent = publishChatEvent
