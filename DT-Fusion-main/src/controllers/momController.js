const Mom = require("../models/Mom")
const { MOM_MEETING_TYPE_VALUES, normalizeMoMMeetingType } = require("../constants/mom")

const cleanMom = (mom) => ({
    id: mom._id.toString(),
    meetingName: mom.meetingName || "",
    date: mom.date || "",
    dtplUsers: Array.isArray(mom.dtplUsers) ? mom.dtplUsers : [],
    externalUsers: Array.isArray(mom.externalUsers) ? mom.externalUsers : [],
    meetingType: normalizeMoMMeetingType(mom.meetingType),
    agenda: mom.agenda || "",
    venue: mom.venue || "",
    meetingLink: mom.meetingLink || "",
    projectLink: mom.projectLink || "",
    discussionPoints: mom.discussionPoints || "",
    targetDate: mom.targetDate || "",
    status: mom.status || "Open",
    discussion: mom.discussion || "",
    actionItems: Array.isArray(mom.actionItems) ? mom.actionItems : [],
    employeeCode: mom.employeeCode || "",
    nextMeeting: mom.nextMeeting || ""
})

//Get

exports.getMoms = async(req, res)=>{
    try{
        const { employeeCode, employeeName, employeeCodes, employeeNames } = req.body || {}
        const codes = [...new Set([
            employeeCode,
            ...(Array.isArray(employeeCodes) ? employeeCodes : []),
        ].filter(Boolean))]
        const names = [...new Set([
            employeeName,
            ...(Array.isArray(employeeNames) ? employeeNames : []),
        ].filter(Boolean))]
        let query = {}
        if (codes.length > 0 || names.length > 0) {
            query = {
                $or: [
                    ...(codes.length > 0 ? [{ employeeCode: { $in: codes } }] : []),
                    ...(names.length > 0 ? [{ dtplUsers: { $in: names } }] : []),
                    ...(codes.length > 0 ? [{ "actionItems.responsibilityId": { $in: codes } }] : []),
                    ...(names.length > 0 ? [{ "actionItems.responsibilityName": { $in: names } }] : []),
                ],
            }
        }
        const moms = await Mom.find(query)
        res.json(moms.map(cleanMom))
    }
    catch(err)
    {
        console.error(err)
        res.status(200).json([])
    }
}

//Post 

exports.createMom = async(req,res)=>{
    try{
        if (!req.body.meetingName || !req.body.date || !req.body.agenda || !req.body.employeeCode) {
            return res.status(400).json({message:"Missing required fields"})
        }

        const meetingType = normalizeMoMMeetingType(req.body.meetingType)
        if (!MOM_MEETING_TYPE_VALUES.includes(meetingType)) {
            return res.status(400).json({message:"Invalid meeting type"})
        }

        const mom = await Mom.create({ ...req.body, meetingType })
        res.status(201).json(cleanMom(mom))
    }
    catch(err)
    {
        res.status(500).json({message:err.message})
    }
}

exports.updateMom = async(req,res)=>{
    try {
        const { id } = req.params;
        const { employeeCode, ...updateData } = req.body;

        if (!id || !employeeCode) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        if ("meetingType" in updateData) {
            updateData.meetingType = normalizeMoMMeetingType(updateData.meetingType);
        }

        const mom = await Mom.findOneAndUpdate({ _id: id, employeeCode }, updateData, { new: true });
        if (!mom) {
            return res.status(404).json({ message: "MoM not found or not editable by this user" });
        }

        res.json(cleanMom(mom));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateMomAction = async (req, res) => {
    try {
        const { id, actionIndex } = req.params
        const { employeeCode, employeeName, userId, status, remark } = req.body || {}
        const allowedStatuses = ["Open", "In Progress", "Completed", "Blocked"]
        const index = Number(actionIndex)

        if (!id || !Number.isInteger(index) || !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid MoM action update" })
        }

        const mom = await Mom.findById(id)
        const actionItem = mom?.actionItems?.[index]
        if (!mom || !actionItem) {
            return res.status(404).json({ message: "MoM action item not found" })
        }

        const responsibilityId = String(actionItem.responsibilityId || "")
        const responsibilityName = String(actionItem.responsibilityName || "").trim().toLowerCase()
        const authorized = [employeeCode, userId].filter(Boolean).includes(responsibilityId) ||
            (employeeName && responsibilityName === String(employeeName).trim().toLowerCase())

        if (!authorized) {
            return res.status(403).json({ message: "Only the responsible user can update this MoM action" })
        }

        actionItem.status = status
        actionItem.remark = typeof remark === "string" ? remark.trim() : actionItem.remark
        await mom.save()

        res.json(cleanMom(mom))
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
}
