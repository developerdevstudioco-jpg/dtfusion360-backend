const Calibration = require("../models/Calibration")
const mongoose = require("mongoose")

// Utility function
const getCalibrationStatus = (dueDate) => {
    const today = new Date()
    const due = new Date(dueDate)

    const diffTime = due - today
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    let status = "Active"

    if (remainingDays < 0) {
        status = "Overdue"
    } else if (remainingDays <= 7) {
        status = "Due Soon"
    }

    return { remainingDays, status }
}


// ✅ GET /api/calibrations
exports.getCalibrations = async (req, res) => {
    try {
        const calibrations = await Calibration.find().sort({ createdAt: -1 })

        const response = calibrations.map((c) => {
            const { remainingDays, status } = getCalibrationStatus(c.dueDate)

            return {
                id: c._id.toString(),
                instrument: c.instrument,
                make: c.make,
                instrumentId: c.instrumentId,
                serialNo: c.serialNo,
                range: c.range,
                acceptanceCriteria: c.acceptanceCriteria,
                calibrationOn: c.calibrationOn
                    ? c.calibrationOn.toISOString().split("T")[0]
                    : null,
                dueDate: c.dueDate
                    ? c.dueDate.toISOString().split("T")[0]
                    : null,
                certificateNo: c.certificateNo,
                calibratedBy: c.calibratedBy,
                remarks: c.remarks,
                remainingDays,
                status
            }
        })

        res.status(200).json(response)

    } catch (err) {
        console.error(err)
        res.status(500).json({
            message: err.message
        })
    }
}


exports.upsertCalibrations = async (req, res) => {
    try {
        const { records } = req.body

        if (!records || !Array.isArray(records)) {
            return res.status(400).json({
                message: "Invalid payload"
            })
        }

        for (let record of records) {

            const {
                id,
                instrument,
                make,
                instrumentId,
                serialNo,
                range,
                acceptanceCriteria,
                calibrationOn,
                dueDate,
                certificateNo,
                calibratedBy,
                remarks
            } = record

            // CHECK if valid Mongo ObjectId
            const isValidId = mongoose.Types.ObjectId.isValid(id)

            if (id && isValidId) {
                // UPDATE
                await Calibration.findByIdAndUpdate(id, {
                    instrument,
                    make,
                    instrumentId,
                    serialNo,
                    range,
                    acceptanceCriteria,
                    calibrationOn,
                    dueDate,
                    certificateNo,
                    calibratedBy,
                    remarks
                })
            } else {
                // CREATE (Excel case OR invalid id)
                await Calibration.create({
                    instrument,
                    make,
                    instrumentId,
                    serialNo,
                    range,
                    acceptanceCriteria,
                    calibrationOn,
                    dueDate,
                    certificateNo,
                    calibratedBy,
                    remarks
                })
            }
        }

        res.status(200).json({
            message: "Calibrations updated successfully"
        })

    } catch (err) {
        console.error(err)
        res.status(500).json({
            message: err.message
        })
    }
}