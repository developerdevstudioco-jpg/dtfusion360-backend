const Calibration = require("../models/Calibration")
const mongoose = require("mongoose")
const { sendCalibrationStatusEmail } = require("../services/calibrationStatusEmailService")

const DAY_IN_MS = 1000 * 60 * 60 * 24
const DD_MM_YYYY_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/
const YYYY_MM_DD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const PRESET_FREQUENCIES = {
    "1 month": { value: 1, unit: "months" },
    "3 month": { value: 3, unit: "months" },
    "3 months": { value: 3, unit: "months" },
    "6 month": { value: 6, unit: "months" },
    "6 months": { value: 6, unit: "months" },
    "12 month": { value: 12, unit: "months" },
    "12 months": { value: 12, unit: "months" }
}

const sanitizeString = (value) => {
    if (value === null || value === undefined) {
        return ""
    }

    return String(value).trim()
}

const hasMeaningfulString = (value) => {
    const normalized = sanitizeString(value)
    return normalized !== "" && normalized !== "-"
}

const buildUtcDate = (year, month, day) => {
    const date = new Date(Date.UTC(year, month - 1, day))

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null
    }

    return date
}

const parseDateValue = (value) => {
    if (!value) {
        return null
    }

    if (value instanceof Date) {
        return buildUtcDate(
            value.getUTCFullYear(),
            value.getUTCMonth() + 1,
            value.getUTCDate()
        )
    }

    const normalized = sanitizeString(value).replace(/[/.]/g, "-")

    if (!normalized) {
        return null
    }

    const ddMmYyyyMatch = normalized.match(DD_MM_YYYY_PATTERN)
    if (ddMmYyyyMatch) {
        return buildUtcDate(
            Number(ddMmYyyyMatch[3]),
            Number(ddMmYyyyMatch[2]),
            Number(ddMmYyyyMatch[1])
        )
    }

    const yyyyMmDdMatch = normalized.match(YYYY_MM_DD_PATTERN)
    if (yyyyMmDdMatch) {
        return buildUtcDate(
            Number(yyyyMmDdMatch[1]),
            Number(yyyyMmDdMatch[2]),
            Number(yyyyMmDdMatch[3])
        )
    }

    const date = new Date(normalized)

    if (Number.isNaN(date.getTime())) {
        return null
    }

    return buildUtcDate(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
    )
}

const formatDateValue = (value) => {
    const date = parseDateValue(value)
    if (!date) {
        return null
    }

    const day = String(date.getUTCDate()).padStart(2, "0")
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    const year = String(date.getUTCFullYear())

    return `${day}-${month}-${year}`
}

const parseFrequency = (frequency) => {
    const normalized = sanitizeString(frequency).toLowerCase().replace(/\s+/g, " ")

    if (!normalized) {
        return null
    }

    if (PRESET_FREQUENCIES[normalized]) {
        return PRESET_FREQUENCIES[normalized]
    }

    const customMatch = normalized.match(/custom\s*:?\s*(\d+)\s*(day|days|month|months)$/i)
    if (customMatch) {
        return {
            value: Number(customMatch[1]),
            unit: customMatch[2].toLowerCase().startsWith("day") ? "days" : "months"
        }
    }

    const genericMatch = normalized.match(/^(\d+)\s*(day|days|month|months)$/i)
    if (genericMatch) {
        return {
            value: Number(genericMatch[1]),
            unit: genericMatch[2].toLowerCase().startsWith("day") ? "days" : "months"
        }
    }

    return null
}

const calculateDueDate = (calibrationOn, calibrationFrequency, fallbackDueDate) => {
    const baseDate = parseDateValue(calibrationOn)

    if (!baseDate) {
        return null
    }

    const parsedFrequency = parseFrequency(calibrationFrequency)

    if (!parsedFrequency) {
        return parseDateValue(fallbackDueDate)
    }

    const dueDate = new Date(baseDate)

    if (parsedFrequency.unit === "days") {
        dueDate.setUTCDate(dueDate.getUTCDate() + parsedFrequency.value)
    } else {
        dueDate.setUTCMonth(dueDate.getUTCMonth() + parsedFrequency.value)
    }

    return dueDate
}

const getCalibrationStatus = (calibrationOn, dueDate) => {
    const calibrationDate = parseDateValue(calibrationOn)

    if (!calibrationDate) {
        return { remainingDays: null, status: "Enter Calib on Date" }
    }

    const due = parseDateValue(dueDate)

    if (!due) {
        return { remainingDays: null, status: "Not Scheduled" }
    }

    const today = new Date()
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
    const diffTime = dueUtc - todayUtc
    const remainingDays = Math.ceil(diffTime / DAY_IN_MS)

    let status = "Good"

    if (remainingDays <= 2) {
        status = "Over Due"
    } else if (remainingDays <= 6) {
        status = "Due Near"
    } else if (remainingDays <= 20) {
        status = "Due Soon"
    }

    return { remainingDays, status }
}

const initializeStatusTracking = (calibration, status) => {
    calibration.lastKnownStatus = sanitizeString(status)

    if (!sanitizeString(calibration.statusNotificationLastStatus)) {
        calibration.statusNotificationLastStatus = ""
    }

    if (!sanitizeString(calibration.statusNotificationLastError)) {
        calibration.statusNotificationLastError = ""
    }
}

const mapCalibrationResponse = (calibration) => {
    const { remainingDays, status } = getCalibrationStatus(calibration.calibrationOn, calibration.dueDate)

    return {
        id: calibration._id.toString(),
        slNo: sanitizeString(calibration.slNo),
        instrument: sanitizeString(calibration.instrument),
        make: sanitizeString(calibration.make),
        instrumentId: sanitizeString(calibration.instrumentId),
        serialNo: sanitizeString(calibration.serialNo),
        leastCount: sanitizeString(calibration.leastCount),
        range: sanitizeString(calibration.range),
        location: sanitizeString(calibration.location),
        acceptanceCriteria: sanitizeString(calibration.acceptanceCriteria),
        maxPermissibleError: sanitizeString(calibration.maxPermissibleError),
        calibrationOn: formatDateValue(calibration.calibrationOn),
        dueDate: formatDateValue(calibration.dueDate),
        remainingDays,
        status,
        certificateNo: sanitizeString(calibration.certificateNo),
        calibratedBy: sanitizeString(calibration.calibratedBy),
        calibrationFrequency: sanitizeString(calibration.calibrationFrequency),
        certificateVerifiedBy: sanitizeString(calibration.certificateVerifiedBy),
        remarks: sanitizeString(calibration.remarks)
    }
}

const syncStatusNotificationState = async (calibration) => {
    const notificationSnapshot = mapCalibrationResponse(calibration)
    const nextStatus = sanitizeString(notificationSnapshot.status)
    const previousStatus = sanitizeString(calibration.lastKnownStatus)

    if (!previousStatus) {
        initializeStatusTracking(calibration, nextStatus)
        return
    }

    if (previousStatus === nextStatus) {
        calibration.lastKnownStatus = nextStatus
        return
    }

    const emailResult = await sendCalibrationStatusEmail({
        calibration: notificationSnapshot,
        previousStatus,
        currentStatus: nextStatus
    })

    calibration.lastKnownStatus = nextStatus
    calibration.statusNotificationLastError = emailResult.sent ? "" : sanitizeString(emailResult.reason)

    if (emailResult.sent) {
        calibration.statusNotificationLastStatus = nextStatus
        calibration.statusNotificationLastSentAt = new Date()
    }
}

const buildCalibrationPayload = (record) => {
    const payload = {
        slNo: sanitizeString(record.slNo),
        instrument: sanitizeString(record.instrument),
        make: sanitizeString(record.make),
        instrumentId: sanitizeString(record.instrumentId),
        serialNo: sanitizeString(record.serialNo),
        leastCount: sanitizeString(record.leastCount),
        range: sanitizeString(record.range),
        location: sanitizeString(record.location),
        acceptanceCriteria: sanitizeString(record.acceptanceCriteria),
        maxPermissibleError: sanitizeString(record.maxPermissibleError),
        calibrationOn: parseDateValue(record.calibrationOn),
        certificateNo: sanitizeString(record.certificateNo),
        calibratedBy: sanitizeString(record.calibratedBy),
        calibrationFrequency: sanitizeString(record.calibrationFrequency),
        certificateVerifiedBy: sanitizeString(record.certificateVerifiedBy),
        remarks: sanitizeString(record.remarks)
    }

    payload.dueDate = calculateDueDate(payload.calibrationOn, payload.calibrationFrequency, record.dueDate)

    return payload
}

const buildMergedCalibrationRecord = (existingCalibration, incomingRecord) => {
    const getMergedString = (field) => {
        const incomingValue = sanitizeString(incomingRecord[field])
        return hasMeaningfulString(incomingValue) ? incomingValue : sanitizeString(existingCalibration[field])
    }

    const getMergedDate = (field) => {
        const incomingDate = parseDateValue(incomingRecord[field])
        if (incomingDate) {
            return formatDateValue(incomingDate)
        }

        return formatDateValue(existingCalibration[field])
    }

    return {
        slNo: getMergedString("slNo"),
        instrument: getMergedString("instrument"),
        make: getMergedString("make"),
        instrumentId: getMergedString("instrumentId"),
        serialNo: getMergedString("serialNo"),
        leastCount: getMergedString("leastCount"),
        range: getMergedString("range"),
        location: getMergedString("location"),
        acceptanceCriteria: getMergedString("acceptanceCriteria"),
        maxPermissibleError: getMergedString("maxPermissibleError"),
        calibrationOn: getMergedDate("calibrationOn"),
        certificateNo: getMergedString("certificateNo"),
        calibratedBy: getMergedString("calibratedBy"),
        calibrationFrequency: getMergedString("calibrationFrequency"),
        certificateVerifiedBy: getMergedString("certificateVerifiedBy"),
        remarks: getMergedString("remarks")
    }
}

exports.getCalibrations = async (req, res) => {
    try {
        const calibrations = await Calibration.find().sort({ createdAt: -1 })
        const response = []

        for (const calibration of calibrations) {
            await syncStatusNotificationState(calibration)
            await calibration.save()
            response.push(mapCalibrationResponse(calibration))
        }

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

        let processedCount = 0
        let skippedCount = 0

        for (const record of records) {
            if (!record || typeof record !== "object") {
                skippedCount += 1
                continue
            }

            const id = sanitizeString(record.id)
            const normalizedInstrumentId = sanitizeString(record.instrumentId)
            const payload = buildCalibrationPayload(record)

            if (!payload.instrument || payload.instrument === "-") {
                skippedCount += 1
                continue
            }

            const isValidId = mongoose.Types.ObjectId.isValid(id)

            let existingCalibration = null

            if (id && isValidId) {
                existingCalibration = await Calibration.findById(id)
            }

            if (!existingCalibration && hasMeaningfulString(normalizedInstrumentId)) {
                existingCalibration = await Calibration.findOne({
                    instrumentId: normalizedInstrumentId
                })
            }

            if (existingCalibration) {
                const nextPayload =
                    hasMeaningfulString(normalizedInstrumentId) && sanitizeString(existingCalibration.instrumentId) === normalizedInstrumentId && !id
                        ? buildCalibrationPayload(buildMergedCalibrationRecord(existingCalibration, record))
                        : payload

                Object.assign(existingCalibration, nextPayload)
                await syncStatusNotificationState(existingCalibration)
                await existingCalibration.save()
            } else {
                const calibration = new Calibration(payload)
                initializeStatusTracking(calibration, getCalibrationStatus(calibration.calibrationOn, calibration.dueDate).status)
                await calibration.save()
            }

            processedCount += 1
        }

        if (processedCount === 0) {
            return res.status(400).json({
                message: "No valid calibration records found in the uploaded file"
            })
        }

        res.status(200).json({
            message: "Calibrations updated successfully",
            processedCount,
            skippedCount
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({
            message: err.message
        })
    }
}

exports.deleteCalibration = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid calibration id"
            })
        }

        const deletedCalibration = await Calibration.findByIdAndDelete(id)

        if (!deletedCalibration) {
            return res.status(404).json({
                message: "Calibration record not found"
            })
        }

        res.status(200).json({
            message: "Calibration deleted successfully"
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({
            message: err.message
        })
    }
}
