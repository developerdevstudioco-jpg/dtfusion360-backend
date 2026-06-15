const mongoose = require("mongoose")

const MomSchema = new mongoose.Schema({
   employeeCode: {
  type: String,
  required: true
},
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
    projectLink:String,
    discussionPoints:String,
    discussion:String,
    targetDate:String,
    status:{ type: String, default: "Open" },
    actionItems: [
      {
        discussionPoint: String,
        action: String,
        responsibilityId: String,
        responsibilityName: String,
        targetDate: String,
        status: { type: String, default: 'Open' },
        remark: String,
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
