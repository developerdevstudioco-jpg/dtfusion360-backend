const mongoose = require("mongoose")

const CalibrationSchema = new mongoose.Schema(
{
    instrument: {
        type: String,
        required: true
    },
    make: {
        type: String
    },
    instrumentId: {
        type: String
    },
    serialNo: {
        type: String
    },
    range: {
        type: String
    },
    acceptanceCriteria: {
        type: String
    },
    calibrationOn: {
        type: Date
    },
    dueDate: {
        type: Date
    },
    certificateNo: {
        type: String
    },
    calibratedBy: {
        type: String
    },
    remarks: {
        type: String
    }
},
{
    timestamps: true
}
)

// Convert _id → id (same pattern you’ll likely use in User)
CalibrationSchema.set("toJSON", {
    transform: (doc, ret) => {
        ret.id = ret._id.toString()
        delete ret._id
        delete ret.__v
    }
})

module.exports = mongoose.model("Calibration", CalibrationSchema)