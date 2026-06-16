const express = require("express")
const cors = require("cors")
const dotenv = require("dotenv")
const path = require("path")
const http = require("http")
//const app = require("./app")
const initWebSocket = require("./socket/stompServer")

const connectDB = require("./config/db")

const organizationRoutes = require("./routes/organizationRoutes")
const userRoutes = require("./routes/userRoutes")
const authRoutes = require("./routes/authRoutes")
const eventRoutes = require("./routes/eventRoutes")
const momRoutes = require("./routes/momRoutes")
const fileRoutes = require("./routes/fileRoutes")
const managerRoutes = require("./routes/managerRoutes")
const calibrationRoutes = require("./routes/calibrationRoutes")
const rbacRoutes = require("./routes/rbacRoutes")
const assetsRoutes = require("./routes/assetsRoutes")
const chatRoutes = require("./routes/chatRoutes")
const taskRoutes = require("./routes/taskRoutes")
const taskGroupRoutes = require("./routes/taskGroupRoutes")
const projectRoutes = require("./routes/projectRoutes")

// ✅ NEW: STOMP socket
const initStompServer = require("./socket/stompServer")

dotenv.config()
console.log("SMTP_HOST:", process.env.SMTP_HOST)
const app = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Static files
app.use(express.static(path.join(__dirname, "../uploads")))

// Only serve built frontend in production when the app is deployed together.
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../../build")))
}

connectDB()

// ROUTES
app.use("/api/organization", organizationRoutes)
app.use("/api/users", userRoutes)
app.use("/api/auth", authRoutes)
app.use("/events", eventRoutes)
app.use("/moms", momRoutes)
app.use("/api/files", fileRoutes)
app.use("/api/managers", managerRoutes)
app.use("/api/calibrations", calibrationRoutes)
app.use("/api/rbac", rbacRoutes)
app.use("/", assetsRoutes)
app.use("/api/chat", chatRoutes)
app.use("/api/tasks", taskRoutes);
app.use("/api/task-groups", taskGroupRoutes);
app.use("/api/projects", projectRoutes);

app.get("/", (req, res) => res.send("DT Fusion360 Backend Running"))

/* =========================
   🔥 STOMP WEBSOCKET
========================= */

// ✅ create HTTP server
const server = http.createServer(app)

// ✅ attach STOMP server (IMPORTANT)
initStompServer(server)

/* =========================
   🚀 START SERVER
========================= */

const PORT = process.env.PORT || 8080

server.listen(PORT, () => {
  console.log(`🚀 Server + STOMP WS running on ${PORT}`)
})
