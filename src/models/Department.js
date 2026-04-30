
const mongoose=require("mongoose")

const DepartmentSchema=new mongoose.Schema({
id:String,
code:String,
name:String,
plantId:String,
isActive:{type:Boolean,default:true}
})

module.exports=mongoose.model("Department",DepartmentSchema)
