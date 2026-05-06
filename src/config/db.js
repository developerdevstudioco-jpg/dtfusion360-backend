
const mongoose=require("mongoose")

const normalizeConnectionString = (value) => {
const normalizedValue = typeof value === "string" ? value.trim().replace(/^["']|["']$/g, "") : ""
return normalizedValue
}

const resolveMongoUri = () => {
const mongoUriCandidates = [
process.env.MONGO_URI,
process.env.MONGODB_URI,
process.env.DATABASE_URL
].map(normalizeConnectionString).filter(Boolean)

if (mongoUriCandidates.length === 0) {
throw new Error("MongoDB connection string is not configured. Set MONGO_URI, MONGODB_URI, or DATABASE_URL.")
}

const mongoUri = mongoUriCandidates[0]

if (!/^mongodb(\+srv)?:\/\//i.test(mongoUri)) {
throw new Error("MongoDB connection string is invalid. It must start with mongodb:// or mongodb+srv://")
}

if (mongoUri.includes("your-production-mongodb-connection-string")) {
throw new Error("MongoDB connection string is still using the placeholder value. Update MONGO_URI with the real database URL.")
}

return mongoUri
}

const connectDB=async()=>{
try{
const mongoUri = resolveMongoUri()

await mongoose.connect(mongoUri)
console.log("MongoDB Connected")
}catch(err){
console.error(err)
process.exit(1)
}
}

module.exports=connectDB
