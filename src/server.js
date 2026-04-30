
const express=require("express")
const cors=require("cors")
const dotenv=require("dotenv")
const path=require("path")
const connectDB=require("./config/db")

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



dotenv.config()
const app=express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve static assets (logo, images, etc.)
app.use(express.static(path.join(__dirname, '../uploads')))
app.use(express.static(path.join(__dirname, '../../build')))

connectDB()

app.use("/api/organization",organizationRoutes)
app.use("/api/users", userRoutes)
app.use("/api/auth",authRoutes)
app.use("/events", eventRoutes)
app.use("/moms",momRoutes)
app.use("/api/files",fileRoutes)
app.use("/api/managers",managerRoutes)
app.use("/api/calibrations", calibrationRoutes);
app.use("/api/rbac", rbacRoutes);
app.use("/", assetsRoutes);

app.get("/",(req,res)=>res.send("DT Fusion360 Backend Running"))

const PORT=process.env.PORT||8080
app.listen(PORT,()=>console.log(`Server running ${PORT}`))
