const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  employeeCode:String,
  mobile: String,
  role: String,
  plantIds: [String],
  password: String,
  departmentIds: [String],
  teams: [String],
  isActive: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false }
})
UserSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    delete ret.password
  }
})

module.exports = mongoose.model("User", UserSchema)
