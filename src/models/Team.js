
const mongoose=require("mongoose")

const TeamSchema=new mongoose.Schema({
id:String,
code:String,
name:String,
departmentId:String,
isActive:{type:Boolean,default:true}
})

module.exports=mongoose.model("Team",TeamSchema)
