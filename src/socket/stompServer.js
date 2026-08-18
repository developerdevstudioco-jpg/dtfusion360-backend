const WebSocket = require("ws")
const Message = require("../models/Message")


const clients = new Map()

const initWebSocket = (server) => {
  const wss = new WebSocket.Server({ server })

  wss.on("connection", (ws, req) => {
    console.log("\n🔌 WS CONNECTED")

    let userId = null

    ws.on("message", async (raw) => {
      try {
        const msg = raw.toString()

        console.log("\n📨 RAW MESSAGE:\n", msg)

        // =========================
        // 🔹 HANDLE CONNECT FRAME
        // =========================
        if (msg.startsWith("CONNECT")) {
          const lines = msg.split("\n")

          const loginLine = lines.find(l => l.startsWith("login:"))

          if (!loginLine) {
            console.warn("⚠️ No login found in CONNECT")
            return
          }

          userId = loginLine.split(":")[1].trim()

          console.log("✅ WS USER CONNECTED:", userId)

          clients.set(userId, ws)

          console.log("👥 ACTIVE USERS:", Array.from(clients.keys()))

          return
        }

        // =========================
        // 🔹 HANDLE SEND FRAME
        // =========================
        if (!msg.startsWith("SEND")) return

        let body = msg.split("\n\n")[1]
        if (!body) {
          console.warn("⚠️ No body in SEND frame")
          return
        }

        body = body.replace(/\0/g, "")

        const data = JSON.parse(body)

        const { from, to, message } = data

        console.log("📩 PARSED MESSAGE:", data)

        // fallback attach user if not already
        if (!userId && from) {
          userId = from
          clients.set(userId, ws)
          console.log("⚡ Late binding user:", userId)
        }

        if (!from || !to) {
          console.warn("⚠️ Missing from/to")
          return
        }

        // CRITICAL FIX: stable conversationId
        const conversationId = "c_" + [from, to].sort().join("_")

        console.log("💬 conversationId:", conversationId)

        // =========================
        // 🔹 SAVE MESSAGE
        // =========================
        const saved = await Message.create({
          conversationId,
          senderId: from,
          body: message
        })

        console.log("💾 Message saved:", saved._id)

        const payload = {
          id: saved._id.toString(),
          conversationId,
          senderId: from,
          body: message,
          createdAt: saved.createdAt,
          status: "SENT",
          deliveredTo: [],
          readBy: [],
          reactions: []
        }

        console.log("📦 Payload:", payload)

        // =========================
        // 🔹 SEND TO RECEIVER
        // =========================
        const receiver = clients.get(to)

        if (receiver && receiver.readyState === WebSocket.OPEN) {
          console.log("📤 Sending to receiver:", to)

          receiver.send(JSON.stringify({
            type: "MESSAGE_NEW",
            payload
          }))
        } else {
          console.warn("⚠️ Receiver not connected:", to)
        }

        // =========================
        // 🔹 SEND TO SENDER (echo)
        // =========================
        if (ws.readyState === WebSocket.OPEN) {
          console.log("📤 Sending back to sender:", from)

          ws.send(JSON.stringify({
            type: "MESSAGE_NEW",
            payload
          }))
        }

      } catch (err) {
        console.error("❌ WS ERROR:", err)
      }
    })

    ws.on("close", () => {
      if (userId) {
        clients.delete(userId)
        console.log("❌ WS DISCONNECTED:", userId)
      }
    })

    ws.on("error", (err) => {
      console.error("❌ WS SOCKET ERROR:", err)
    })
  })

  return wss
}

module.exports = initWebSocket