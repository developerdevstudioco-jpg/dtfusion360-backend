const mongoose = require("mongoose")

const MomSchema = new mongoose.Schema({
    meetingName:String,
    date:String,
    dtplUsers:[String],
    externalUsers: [
    {
      name: String,
      organization: String,
      designation: String
    }
  ],
    meetingType:String,
    agenda:String,
    venue:String,
    meetingLink:String,
    discussion:String,
    actionItems: [   
    {
      task: String,
      assignee: String,
      deadline: String
    }
  ],
    nextMeeting:String 
})

MomSchema.set("toJSON",{
    transform:(doc,ret)=>{
        ret.id = ret._id.toString()
        delete ret._id
        delete ret.__v
    }
})

module.exports = mongoose.model("Mom",MomSchema)
