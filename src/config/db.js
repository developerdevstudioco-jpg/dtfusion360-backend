
const mongoose=require("mongoose")

const connectDB=async()=>{
try{
//await mongoose.connect("mongodb+srv://santhoshravichandran2208_db_user:vh6WrCwQdpa3XdPc@dtfusiondb-sampledb.jvrrf0j.mongodb.net/?appName=dtfusiondb-sampledb")
await mongoose.connect("mongodb://santhoshravichandran2208_db_user:vh6WrCwQdpa3XdPc@ac-yq30sva-shard-00-00.jvrrf0j.mongodb.net:27017,ac-yq30sva-shard-00-01.jvrrf0j.mongodb.net:27017,ac-yq30sva-shard-00-02.jvrrf0j.mongodb.net:27017/?ssl=true&replicaSet=atlas-6fpuph-shard-0&authSource=admin&appName=dtfusiondb-sampledb")
console.log("MongoDB Connected")
}catch(err){
console.error(err)
process.exit(1)
}
}

module.exports=connectDB
