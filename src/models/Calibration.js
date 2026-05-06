const mongoose = require("mongoose")

const CalibrationSchema = new mongoose.Schema(
{
    slNo: {
        type: String
    },
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
    leastCount: {
        type: String
    },
    range: {
        type: String
    },
    location: {
        type: String
    },
    acceptanceCriteria: {
        type: String
    },
    maxPermissibleError: {
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
    calibrationFrequency: {
        type: String
    },
    certificateVerifiedBy: {
        type: String
    },
    remarks: {
        type: String
    },
    lastKnownStatus: {
        type: String,
        default: ""
    },
    statusNotificationLastStatus: {
        type: String,
        default: ""
    },
    statusNotificationLastSentAt: {
        type: Date,
        default: null
    },
    statusNotificationLastError: {
        type: String,
        default: ""
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
