
const express=require("express")
const cors=require("cors")
const dotenv=require("dotenv")
const path=require("path")
const connectDB=require("./config/db")
const { ensureSystemSuperAdmin } = require("./services/systemSuperAdminService")

const organizationRoutes=require("./routes/organizationRoutes")
const userRoutes = require("./routes/userRoutes")
const authRoutes = require("./routes/authRoutes")
const eventRoutes = require("./routes/eventRoutes")
const momRoutes = require("./routes/momRoutes")
const fileRoutes = require("./routes/fileRoutes")
const managerRoutes = require("./routes/managerRoutes")
const calibrationRoutes = require("./routes/calibrationRoutes")
const rbacRoutes = require("./routes/rbacRoutes")
const assetsRoutes = require("./routes/assetsRoutes")
const taskRoutes = require("./routes/taskRoutes")
const projectRoutes = require("./routes/projectRoutes")



dotenv.config()
const app=express()

const normalizeOrigin = (origin = "") => origin.trim().replace(/\/+$/, "")
const parseAllowedOrigins = (value = "") =>
  value
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://dtfusion360.vercel.app"
]

const configuredAllowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS)
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins].map(normalizeOrigin))
const vercelPreviewOriginPattern = /^https:\/\/dtfusion360(?:-[a-z0-9-]+)?\.vercel\.app$/i

app.set("trust proxy", 1)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true)
    }

    const normalizedOrigin = normalizeOrigin(origin)

    if (allowedOrigins.has(normalizedOrigin) || vercelPreviewOriginPattern.test(normalizedOrigin)) {
      return callback(null, true)
    }

    return callback(new Error(`Origin not allowed by CORS: ${normalizedOrigin}`))
  },
  credentials: true
}))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Serve static assets (logo, images, etc.)
app.use(express.static(path.join(__dirname, '../uploads')))

app.use("/api/organization",organizationRoutes)
app.use("/api/users", userRoutes)
app.use("/api/auth",authRoutes)
app.use("/events", eventRoutes)
app.use("/moms",momRoutes)
app.use("/api/files",fileRoutes)
app.use("/api/managers",managerRoutes)
app.use("/api/calibrations", calibrationRoutes);
app.use("/api/rbac", rbacRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/projects", projectRoutes);
app.use("/", assetsRoutes);

app.get("/",(req,res)=>res.send("DT Fusion360 Backend Running"))

const PORT=process.env.PORT||8080
connectDB()
  .then(() => ensureSystemSuperAdmin())
  .then(() => {
    console.log("System SuperAdmin ready")
    app.listen(PORT,()=>console.log(`Server running ${PORT}`))
  })
  .catch((error) => {
    console.error("Failed to initialize backend:", error)
    process.exit(1)
  })
