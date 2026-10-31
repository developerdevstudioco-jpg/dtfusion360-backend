const fs = require("fs")
const path = require("path")
const { randomUUID } = require("crypto")
const mongoose = require("mongoose")
const User = require("../models/Users")
const Conversation = require("../models/Conversation")
const Message = require("../models/Message")
const MessageAttachment = require("../models/MessageAttachment")
const MessageAuditLog = require("../models/MessageAuditLog")
const Department = require("../models/Department")
const Plant = require("../models/Plant")
const { publishChatEvent } = require("../socket/stompServer")

const REACTIONS = new Set(["👍", "✅", "👌", "🙏", "👏", "🎯", "⚠️", "❓", "👀", "📌"])
const ADMIN_ROLES = new Set(["SuperAdmin", "PlantAdmin", "Admin", "Management", "Messaging Admin"])

const currentUserId = (req) => req.user?.employeeCode || req.headers["x-user"]
const sanitizeText = (value) => String(value || "").replace(/[<>]/g, "").trim().slice(0, 10000)
const isDirectId = (id) => /^c_[^_]+_[^_]+$/.test(id)
const directParticipants = (id) => isDirectId(id) ? id.slice(2).split("_") : []
const isAdmin = (req) => ADMIN_ROLES.has(req.user?.role)

const audit = (data) => MessageAuditLog.create(data).catch((error) => console.error("Chat audit error:", error.message))

async function getConversationForUser(conversationId, userId) {
  const conversation = mongoose.isValidObjectId(conversationId)
    ? await Conversation.findById(conversationId).lean()
    : await Conversation.findOne({ _id: conversationId }).lean().catch(() => null)
  if (conversation) {
    const memberIds = conversation.members?.map((member) => member.userId) || conversation.participants || []
    if (!memberIds.includes(userId)) return null
    return conversation
  }
  if (directParticipants(conversationId).includes(userId)) {
    return { _id: conversationId, channelType: "DIRECT", participants: directParticipants(conversationId), members: [] }
  }
  return null
}

async function ensureOrganizationChannels(userId) {
  const user = await User.findOne({ employeeCode: userId }).select("departmentIds plantIds role").lean()
  if (!user) return
  const [departments, plants, activeUsers] = await Promise.all([
    Department.find({ id: { $in: user.departmentIds || [] }, isActive: { $ne: false } }).lean(),
    Plant.find({ id: { $in: user.plantIds || [] }, isActive: { $ne: false } }).lean(),
    User.find({ isActive: true }).select("employeeCode departmentIds plantIds role").lean(),
  ])
  const definitions = [
    ...departments.map((department) => ({ key: { channelType: "DEPARTMENT", departmentId: department.id, plantId: department.plantId || null }, name: department.name, description: `${department.name} department communication`, participants: activeUsers.filter((item) => item.departmentIds?.includes(department.id)).map((item) => item.employeeCode) })),
    ...plants.map((plant) => ({ key: { channelType: "PLANT", plantId: plant.id, departmentId: null }, name: `${plant.name} · General`, description: `General communication for ${plant.name}`, participants: activeUsers.filter((item) => item.plantIds?.includes(plant.id)).map((item) => item.employeeCode) })),
    { key: { channelType: "DTPL_GROUP", name: "DTPL General" }, name: "DTPL General", description: "Company-wide communication", participants: activeUsers.map((item) => item.employeeCode) },
    { key: { channelType: "DTPL_GROUP", name: "DTPL Announcements" }, name: "DTPL Announcements", description: "Official company announcements", participants: activeUsers.map((item) => item.employeeCode), isAnnouncement: true },
  ]
  for (const definition of definitions) {
    let channel = await Conversation.findOne(definition.key)
    if (!channel) {
      channel = await Conversation.create({ ...definition.key, name: definition.name, description: definition.description, participants: [...new Set(definition.participants)], members: [...new Set(definition.participants)].map((id) => ({ userId: id, role: "MEMBER" })), createdBy: "SYSTEM", isAnnouncement: Boolean(definition.isAnnouncement) })
    } else if (!channel.participants.includes(userId)) {
      channel.participants.push(userId)
      if (!channel.members.some((member) => member.userId === userId)) channel.members.push({ userId, role: "MEMBER" })
      await channel.save()
    }
  }
}

function attachmentDto(attachment) {
  return {
    id: attachment.attachmentId,
    attachmentId: attachment.attachmentId,
    kind: attachment.mimeType?.startsWith("image/") ? "IMAGE" : "FILE",
    name: attachment.fileName,
    fileName: attachment.fileName,
    fileExtension: attachment.fileExtension,
    mimeType: attachment.mimeType,
    size: attachment.fileSize,
    fileSize: attachment.fileSize,
    uploadedBy: attachment.uploadedBy,
    uploadedAt: attachment.uploadedAt,
    securityScanStatus: attachment.securityScanStatus,
    url: `/api/chat/attachments/${attachment.attachmentId}/download`,
    previewUrl: attachment.mimeType?.startsWith("image/") || attachment.mimeType === "application/pdf"
      ? `/api/chat/attachments/${attachment.attachmentId}/download?preview=1`
      : undefined,
  }
}

function messageDto(message) {
  const id = String(message._id || message.id)
  return {
    id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.deletedAt ? "Message deleted" : message.body,
    messageType: message.messageType || "TEXT",
    structuredPayload: message.structuredPayload || null,
    attachments: message.deletedAt ? [] : (message.attachments || []).map(attachmentDto),
    reactions: Object.values((message.reactions || []).reduce((groups, item) => {
      groups[item.reaction] ||= { emoji: item.reaction, userIds: [] }
      groups[item.reaction].userIds.push(item.userId)
      return groups
    }, {})),
    mentions: message.mentions || [],
    status: message.status || "SENT",
    createdAt: message.createdAt,
    updatedAt: message.updatedAt || message.createdAt,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    replyToId: message.parentMessageId,
    deliveredTo: message.deliveredTo || [],
    readBy: message.readBy || [],
    isPinned: (message.pinnedBy || []).length > 0,
    isStarred: false,
  }
}

exports.getContacts = async (req, res) => {
  try {
    const userId = currentUserId(req)
    await ensureOrganizationChannels(userId)
    const [users, channels] = await Promise.all([
      User.find({ isActive: true, employeeCode: { $ne: userId } }).select("name employeeCode avatarUrl presence lastSeenAt role departmentIds plantIds").lean(),
      Conversation.find({ participants: userId, status: { $in: ["ACTIVE", "ARCHIVED"] } }).sort({ updatedAt: -1 }).lean(),
    ])

    const directIds = users.map((user) => `c_${[userId, user.employeeCode].sort().join("_")}`)
    const directLast = await Message.aggregate([
      { $match: { conversationId: { $in: directIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$conversationId", message: { $first: "$$ROOT" } } },
    ])
    const lastById = new Map(directLast.map((entry) => [entry._id, entry.message]))

    const directContacts = users.map((user) => {
      const conversationId = `c_${[userId, user.employeeCode].sort().join("_")}`
      const last = lastById.get(conversationId)
      return {
        conversationId,
        type: "DIRECT",
        channelType: "DIRECT",
        name: user.name || user.employeeCode,
        avatarUrl: user.avatarUrl,
        presence: user.presence || "OFFLINE",
        lastSeenAt: user.lastSeenAt,
        lastMessage: last ? { body: last.deletedAt ? "Message deleted" : last.body, senderId: last.senderId, createdAt: last.createdAt } : null,
        unreadCount: 0,
        participantIds: [userId, user.employeeCode],
        members: [],
        updatedAt: last?.createdAt || new Date(0),
      }
    })

    const channelContacts = channels.map((channel) => {
      const membership = channel.members?.find((member) => member.userId === userId)
      return {
        conversationId: String(channel._id),
        type: channel.channelType === "DIRECT" ? "DIRECT" : "GROUP",
        channelType: channel.channelType,
        name: channel.name,
        description: channel.description,
        avatarUrl: channel.avatarUrl,
        lastMessage: channel.lastMessage,
        unreadCount: 0,
        participantIds: channel.participants,
        members: channel.members,
        memberCount: channel.participants.length,
        isMuted: membership?.isMuted,
        isPinned: membership?.isFavorite,
        notificationSetting: membership?.notificationSetting || "ALL",
        projectId: channel.projectId,
        departmentId: channel.departmentId,
        plantId: channel.plantId,
        isAnnouncement: channel.isAnnouncement,
        status: channel.status,
        updatedAt: channel.updatedAt,
      }
    })

    res.json([...channelContacts, ...directContacts].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)))
  } catch (error) {
    console.error("Chat contacts error:", error)
    res.status(500).json({ message: "Unable to load conversations" })
  }
}

exports.getUsers = async (_req, res) => {
  const users = await User.find({ isActive: true }).select("name employeeCode avatarUrl email mobile role departmentIds plantIds presence lastSeenAt").sort({ name: 1 }).lean()
  res.json(users.map((user) => ({ id: user.employeeCode, ...user, _id: undefined, presence: user.presence || "OFFLINE" })))
}

exports.createConversation = async (req, res) => {
  const userId = currentUserId(req)
  const channelType = String(req.body.channelType || "PRIVATE_GROUP").toUpperCase()
  if (!["DIRECT", "PRIVATE_GROUP"].includes(channelType) && !isAdmin(req)) return res.status(403).json({ message: "Messaging administrator permission required" })
  const participants = [...new Set([userId, ...(Array.isArray(req.body.participantIds) ? req.body.participantIds : [])])]
  if (channelType === "DIRECT" && participants.length === 2) {
    return res.status(201).json({ conversationId: `c_${participants.sort().join("_")}` })
  }
  const conversation = await Conversation.create({
    name: sanitizeText(req.body.name).slice(0, 120),
    description: sanitizeText(req.body.description).slice(0, 1000),
    channelType,
    participants,
    members: participants.map((id) => ({ userId: id, role: id === userId ? "OWNER" : "MEMBER" })),
    createdBy: userId,
    projectId: req.body.projectId || null,
    departmentId: req.body.departmentId || null,
    plantId: req.body.plantId || null,
    isAnnouncement: Boolean(req.body.isAnnouncement),
  })
  await audit({ conversationId: String(conversation._id), action: "CHANNEL_CREATED", performedBy: userId, newValue: { name: conversation.name, channelType } })
  res.status(201).json(conversation)
}

exports.getMessages = async (req, res) => {
  const userId = currentUserId(req)
  const conversation = await getConversationForUser(req.params.conversationId, userId)
  if (!conversation) return res.status(403).json({ message: "Conversation access denied" })
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50))
  const filter = { conversationId: req.params.conversationId }
  const [rows, total, users] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Message.countDocuments(filter),
    User.find({ employeeCode: { $in: conversation.participants } }).select("name employeeCode avatarUrl email mobile role departmentIds plantIds presence lastSeenAt").lean(),
  ])
  res.json({
    data: rows.reverse().map(messageDto),
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
    participants: users.map((user) => ({ id: user.employeeCode, name: user.name, avatarUrl: user.avatarUrl, email: user.email, mobile: user.mobile, role: user.role, department: user.departmentIds?.join(", "), plant: user.plantIds?.join(", "), presence: user.presence || "OFFLINE", lastSeenAt: user.lastSeenAt })),
  })
}

exports.createMessage = async (req, res) => {
  const userId = currentUserId(req)
  const conversationId = req.params.conversationId
  const conversation = await getConversationForUser(conversationId, userId)
  if (!conversation) return res.status(403).json({ message: "Conversation access denied" })
  if (conversation.status === "ARCHIVED") return res.status(409).json({ message: "This channel is archived and read-only" })
  const member = conversation.members?.find((item) => item.userId === userId)
  if (member?.role === "READ_ONLY") return res.status(403).json({ message: "This channel is read-only for your role" })
  if (conversation.isAnnouncement && !isAdmin(req) && !["OWNER", "ADMIN"].includes(member?.role)) {
    return res.status(403).json({ message: "Only channel administrators can post announcements" })
  }

  const body = sanitizeText(req.body.body)
  const attachmentIds = Array.isArray(req.body.attachmentIds) ? req.body.attachmentIds.slice(0, 10) : []
  if (!body && attachmentIds.length === 0 && !req.body.structuredPayload) return res.status(400).json({ message: "Message cannot be empty" })
  if (req.body.clientId) {
    const duplicate = await Message.findOne({ clientId: req.body.clientId, senderId: userId }).lean()
    if (duplicate) return res.status(200).json(messageDto(duplicate))
  }

  const uploadRows = attachmentIds.length
    ? await MessageAttachment.find({ attachmentId: { $in: attachmentIds }, uploadedBy: userId }).select("+storagePath").lean()
    : []
  const attachments = uploadRows.map((item) => ({
    attachmentId: item.attachmentId,
    fileName: item.fileName,
    fileExtension: item.fileExtension,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    storagePath: item.storagePath,
    uploadedBy: item.uploadedBy,
    uploadedAt: item.uploadedAt,
    securityScanStatus: item.securityScanStatus,
  }))

  const mentions = [...new Set(Array.from(body.matchAll(/@([A-Za-z0-9._-]+)/g), (match) => match[1]))]
  const message = await Message.create({
    conversationId,
    senderId: userId,
    clientId: req.body.clientId || null,
    body,
    parentMessageId: req.body.parentMessageId || null,
    messageType: req.body.structuredPayload ? "SYSTEM" : attachments.length ? "FILE" : "TEXT",
    structuredPayload: req.body.structuredPayload || null,
    attachments,
    mentions,
  })
  if (attachmentIds.length) await MessageAttachment.updateMany({ attachmentId: { $in: attachmentIds } }, { messageId: String(message._id), conversationId })
  const summary = { body: message.deletedAt ? "Message deleted" : (message.body || `Attachment: ${attachments[0]?.fileName}`), senderId: userId, createdAt: message.createdAt }
  if (mongoose.isValidObjectId(conversationId)) await Conversation.updateOne({ _id: conversationId }, { lastMessage: summary, updatedAt: message.createdAt })
  await audit({ messageId: String(message._id), conversationId, action: "MESSAGE_CREATED", performedBy: userId, newValue: { body, attachmentIds, mentions } })
  const dto = messageDto(message.toObject())
  const event = { type: "MESSAGE_NEW", ts: new Date().toISOString(), payload: dto }
  publishChatEvent(conversation.participants || directParticipants(conversationId), event)
  res.status(201).json(dto)
}

exports.editMessage = async (req, res) => {
  const userId = currentUserId(req)
  const message = await Message.findById(req.params.messageId)
  if (!message) return res.status(404).json({ message: "Message not found" })
  if (message.senderId !== userId) return res.status(403).json({ message: "You can only edit your own messages" })
  const previous = message.body
  message.body = sanitizeText(req.body.body)
  message.editedAt = new Date()
  message.updatedAt = new Date()
  await message.save()
  await audit({ messageId: String(message._id), conversationId: message.conversationId, action: "MESSAGE_EDITED", performedBy: userId, previousValue: { body: previous }, newValue: { body: message.body } })
  res.json(messageDto(message.toObject()))
}

exports.deleteMessage = async (req, res) => {
  const userId = currentUserId(req)
  const message = await Message.findById(req.params.messageId)
  if (!message) return res.status(404).json({ message: "Message not found" })
  if (message.senderId !== userId && !isAdmin(req)) return res.status(403).json({ message: "Delete permission denied" })
  const previous = { body: message.body, attachments: message.attachments }
  message.deletedAt = new Date()
  message.deletedBy = userId
  message.updatedAt = new Date()
  await message.save()
  await audit({ messageId: String(message._id), conversationId: message.conversationId, action: "MESSAGE_DELETED", performedBy: userId, previousValue: previous })
  res.json(messageDto(message.toObject()))
}

exports.toggleReaction = async (req, res) => {
  const userId = currentUserId(req)
  const reaction = req.body.reaction
  if (!REACTIONS.has(reaction)) return res.status(400).json({ message: "Unsupported reaction" })
  const message = await Message.findById(req.params.messageId)
  if (!message || !(await getConversationForUser(message.conversationId, userId))) return res.status(404).json({ message: "Message not found" })
  const index = message.reactions.findIndex((item) => item.userId === userId && item.reaction === reaction)
  if (index >= 0) message.reactions.splice(index, 1)
  else message.reactions.push({ userId, reaction })
  message.updatedAt = new Date()
  await message.save()
  res.json(messageDto(message.toObject()))
}

exports.togglePin = async (req, res) => {
  const userId = currentUserId(req)
  const message = await Message.findById(req.params.messageId)
  const conversation = message && await getConversationForUser(message.conversationId, userId)
  if (!conversation) return res.status(404).json({ message: "Message not found" })
  const member = conversation.members?.find((item) => item.userId === userId)
  if (!isAdmin(req) && !["OWNER", "ADMIN"].includes(member?.role)) return res.status(403).json({ message: "Pin permission denied" })
  const index = message.pinnedBy.indexOf(userId)
  index >= 0 ? message.pinnedBy.splice(index, 1) : message.pinnedBy.push(userId)
  await message.save()
  res.json(messageDto(message.toObject()))
}

exports.toggleStar = async (req, res) => {
  const userId = currentUserId(req)
  const message = await Message.findById(req.params.messageId)
  if (!message || !(await getConversationForUser(message.conversationId, userId))) return res.status(404).json({ message: "Message not found" })
  const index = message.starredBy.indexOf(userId)
  index >= 0 ? message.starredBy.splice(index, 1) : message.starredBy.push(userId)
  await message.save()
  const dto = messageDto(message.toObject())
  dto.isStarred = message.starredBy.includes(userId)
  res.json(dto)
}

exports.markRead = async (req, res) => {
  const userId = currentUserId(req)
  if (!(await getConversationForUser(req.params.conversationId, userId))) return res.status(403).json({ message: "Conversation access denied" })
  await Message.updateMany({ conversationId: req.params.conversationId, readBy: { $ne: userId } }, { $addToSet: { readBy: userId }, $set: { status: "READ" } })
  res.json({ success: true })
}

exports.searchMessages = async (req, res) => {
  const userId = currentUserId(req)
  const channelIds = (await Conversation.find({ participants: userId }).select("_id").lean()).map((item) => String(item._id))
  const directIds = (await User.find({ isActive: true, employeeCode: { $ne: userId } }).select("employeeCode").lean()).map((user) => `c_${[userId, user.employeeCode].sort().join("_")}`)
  const allowed = [...channelIds, ...directIds]
  const filter = { conversationId: { $in: allowed }, deletedAt: null }
  if (req.query.q) filter.$text = { $search: sanitizeText(req.query.q) }
  if (req.query.channelId) filter.conversationId = req.query.channelId
  if (req.query.userId) filter.senderId = req.query.userId
  if (req.query.from || req.query.to) filter.createdAt = { ...(req.query.from && { $gte: new Date(req.query.from) }), ...(req.query.to && { $lte: new Date(req.query.to) }) }
  const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(100).lean()
  res.json(rows.map(messageDto))
}

exports.uploadMedia = async (req, res) => {
  const userId = currentUserId(req)
  const attachments = await Promise.all((req.files || []).map(async (file) => {
    const record = await MessageAttachment.create({
      attachmentId: randomUUID(),
      conversationId: req.body.conversationId || null,
      fileName: file.originalname,
      fileExtension: path.extname(file.originalname).slice(1).toLowerCase(),
      mimeType: file.mimetype || "application/octet-stream",
      fileSize: file.size,
      storagePath: file.path,
      uploadedBy: userId,
      securityScanStatus: "CLEAN",
    })
    await audit({ conversationId: req.body.conversationId || "unassigned", action: "ATTACHMENT_UPLOADED", performedBy: userId, newValue: { attachmentId: record.attachmentId, fileName: record.fileName, fileSize: record.fileSize } })
    return attachmentDto(record)
  }))
  res.status(201).json({ attachments })
}

exports.downloadAttachment = async (req, res) => {
  const userId = currentUserId(req)
  const attachment = await MessageAttachment.findOne({ attachmentId: req.params.attachmentId }).select("+storagePath")
  if (!attachment) return res.status(404).json({ message: "Attachment not found" })
  if (attachment.conversationId && !(await getConversationForUser(attachment.conversationId, userId))) return res.status(403).json({ message: "Attachment access denied" })
  if (!fs.existsSync(attachment.storagePath)) return res.status(404).json({ message: "Attachment file is unavailable" })
  await audit({ messageId: attachment.messageId, conversationId: attachment.conversationId || "unassigned", action: "ATTACHMENT_DOWNLOADED", performedBy: userId, newValue: { attachmentId: attachment.attachmentId } })
  if (req.query.preview === "1") res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`)
  else res.attachment(attachment.fileName)
  res.type(attachment.mimeType)
  res.sendFile(path.resolve(attachment.storagePath))
}

exports.updatePreferences = async (req, res) => {
  const userId = currentUserId(req)
  const conversation = await Conversation.findOne({ _id: req.params.conversationId, "members.userId": userId })
  if (!conversation) return res.status(404).json({ message: "Channel not found" })
  const member = conversation.members.find((item) => item.userId === userId)
  if (req.body.notificationSetting && ["ALL", "MENTIONS", "MUTED"].includes(req.body.notificationSetting)) member.notificationSetting = req.body.notificationSetting
  if (typeof req.body.isFavorite === "boolean") member.isFavorite = req.body.isFavorite
  if (typeof req.body.isMuted === "boolean") member.isMuted = req.body.isMuted
  await conversation.save()
  res.json(member)
}

async function requireChannelAdmin(req, res) {
  const userId = currentUserId(req)
  const conversation = await Conversation.findById(req.params.conversationId)
  const membership = conversation?.members?.find((member) => member.userId === userId)
  if (!conversation) { res.status(404).json({ message: "Channel not found" }); return null }
  if (!isAdmin(req) && !["OWNER", "ADMIN"].includes(membership?.role)) { res.status(403).json({ message: "Channel administrator permission required" }); return null }
  return conversation
}

exports.updateConversation = async (req, res) => {
  const conversation = await requireChannelAdmin(req, res)
  if (!conversation) return
  const previous = { name: conversation.name, description: conversation.description, status: conversation.status }
  if (typeof req.body.name === "string") conversation.name = sanitizeText(req.body.name).slice(0, 120)
  if (typeof req.body.description === "string") conversation.description = sanitizeText(req.body.description).slice(0, 1000)
  if (["ACTIVE", "ARCHIVED"].includes(req.body.status)) conversation.status = req.body.status
  if (typeof req.body.isAnnouncement === "boolean") conversation.isAnnouncement = req.body.isAnnouncement
  await conversation.save()
  const action = conversation.status === "ARCHIVED" && previous.status !== "ARCHIVED" ? "CHANNEL_ARCHIVED" : "CHANNEL_UPDATED"
  await audit({ conversationId: String(conversation._id), action, performedBy: currentUserId(req), previousValue: previous, newValue: { name: conversation.name, description: conversation.description, status: conversation.status } })
  res.json(conversation)
}

exports.addMember = async (req, res) => {
  const conversation = await requireChannelAdmin(req, res)
  if (!conversation) return
  const userId = sanitizeText(req.body.userId)
  const user = await User.findOne({ employeeCode: userId, isActive: true }).lean()
  if (!user) return res.status(404).json({ message: "User not found" })
  if (!conversation.participants.includes(userId)) conversation.participants.push(userId)
  if (!conversation.members.some((member) => member.userId === userId)) conversation.members.push({ userId, role: req.body.role || "MEMBER" })
  await conversation.save()
  await audit({ conversationId: String(conversation._id), action: "MEMBER_ADDED", performedBy: currentUserId(req), newValue: { userId } })
  res.status(201).json(conversation)
}

exports.removeMember = async (req, res) => {
  const conversation = await requireChannelAdmin(req, res)
  if (!conversation) return
  const target = req.params.userId
  const member = conversation.members.find((item) => item.userId === target)
  if (member?.role === "OWNER") return res.status(409).json({ message: "Transfer channel ownership before removing the owner" })
  conversation.participants = conversation.participants.filter((id) => id !== target)
  conversation.members = conversation.members.filter((item) => item.userId !== target)
  await conversation.save()
  await audit({ conversationId: String(conversation._id), action: "MEMBER_REMOVED", performedBy: currentUserId(req), previousValue: { userId: target } })
  res.json(conversation)
}

exports.changeMemberRole = async (req, res) => {
  const conversation = await requireChannelAdmin(req, res)
  if (!conversation) return
  const role = req.body.role
  if (!["OWNER", "ADMIN", "MEMBER", "READ_ONLY"].includes(role)) return res.status(400).json({ message: "Invalid channel role" })
  const member = conversation.members.find((item) => item.userId === req.params.userId)
  if (!member) return res.status(404).json({ message: "Member not found" })
  const previousRole = member.role
  member.role = role
  await conversation.save()
  await audit({ conversationId: String(conversation._id), action: "ROLE_CHANGED", performedBy: currentUserId(req), previousValue: { userId: member.userId, role: previousRole }, newValue: { userId: member.userId, role } })
  res.json(conversation)
}

exports.getNotifications = async (req, res) => {
  const userId = currentUserId(req)
  const channelIds = (await Conversation.find({ participants: userId }).select("_id").lean()).map((item) => String(item._id))
  const directIds = (await User.find({ isActive: true, employeeCode: { $ne: userId } }).select("employeeCode").lean()).map((user) => `c_${[userId, user.employeeCode].sort().join("_")}`)
  const rows = await Message.find({ conversationId: { $in: [...channelIds, ...directIds] }, senderId: { $ne: userId }, deletedAt: null, readBy: { $ne: userId } }).sort({ createdAt: -1 }).limit(100).lean()
  res.json(rows.map((message) => ({ ...messageDto(message), notificationType: message.mentions?.includes(userId) ? "MENTION" : "MESSAGE", unread: true })))
}

exports.getAuditLog = async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ message: "Audit permission required" })
  const rows = await MessageAuditLog.find({ conversationId: req.params.conversationId }).sort({ timestamp: -1 }).limit(250).lean()
  res.json(rows)
}
