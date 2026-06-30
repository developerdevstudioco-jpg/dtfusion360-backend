const Mom = require("../models/Mom")

const cleanMom = (mom) => ({
    id: mom._id.toString(),
    meetingName: mom.meetingName || "",
    date: mom.date || "",
    dtplUsers: Array.isArray(mom.dtplUsers) ? mom.dtplUsers : [],
    externalUsers: Array.isArray(mom.externalUsers) ? mom.externalUsers : [],
    meetingType: mom.meetingType || "internal-to-customer",
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
        const { employeeCode, employeeName } = req.body || {}
        let query = {}
        if (employeeCode || employeeName) {
            query = {
                $or: [
                    ...(employeeCode ? [{ employeeCode }] : []),
                    ...(employeeName ? [{ dtplUsers: employeeName }] : []),
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

        const mom = await Mom.create(req.body)
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

        const mom = await Mom.findOneAndUpdate({ _id: id, employeeCode }, updateData, { new: true });
        if (!mom) {
            return res.status(404).json({ message: "MoM not found or not editable by this user" });
        }

        res.json(cleanMom(mom));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
