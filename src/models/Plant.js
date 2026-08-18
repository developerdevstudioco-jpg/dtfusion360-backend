
const mongoose=require("mongoose")

const PlantSchema=new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: String,
  isActive: { type: Boolean, default: true }
})

module.exports=mongoose.model("Plant",PlantSchema)
