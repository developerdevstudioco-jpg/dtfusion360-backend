const Task = require("../models/Task")

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "")

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  if (typeof value === "string" && value.trim()) {
    return value.split(/[|;]/).map((entry) => entry.trim()).filter(Boolean)
  }

  return []
}

const formatTask = (task) => {
  const departmentIds = normalizeStringArray(task.departmentIds)
  const departmentId = task.departmentId || departmentIds[0] || ""

  return {
    id: task.id || task._id.toString(),
    name: task.name,
    departmentId,
    departmentIds: departmentIds.length > 0 ? departmentIds : departmentId ? [departmentId] : [],
    phase: task.phase,
    description: task.description || "",
    supportingDoc: task.supportingDoc || "",
    isCftTask: Boolean(task.isCftTask),
    cftTeam: task.cftTeam || "",
  }
}

exports.listTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
    const formattedTasks = tasks.map(formatTask)
    res.json(formattedTasks)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.addTask = async (req, res) => {
  try {
    const { description, supportingDoc } = req.body
    const name = normalizeString(req.body?.name)
    const departmentIds = normalizeStringArray(req.body?.departmentIds)
    const departmentId = normalizeString(req.body?.departmentId) || departmentIds[0] || ""
    const phase = normalizeString(req.body?.phase)

    if (!name || !departmentId || !phase) {
      return res.status(400).json({
        error: "Name, departmentId, and phase are required"
      })
    }

    const task = await Task.create({
      id: `TASK${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      departmentId,
      departmentIds: departmentIds.length > 0 ? departmentIds : [departmentId],
      phase,
      description: normalizeString(description),
      supportingDoc: normalizeString(supportingDoc),
      isCftTask: Boolean(req.body?.isCftTask),
      cftTeam: normalizeString(req.body?.cftTeam),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Return formatted response matching TaskTemplate interface
    res.status(201).json(formatTask(task))
  } catch (err) {
    console.error("Error adding task:", err)
    res.status(500).json({ error: err.message })
  }
}

exports.updateTask = async (req, res) => {
  try {
    const { id, name, departmentId, departmentIds, phase, description, supportingDoc, isCftTask, cftTeam } = req.body

    if (!id) {
      return res.status(400).json({
        error: "Task id is required"
      })
    }

    const task = await Task.findOne({ id })

    if (!task) {
      return res.status(404).json({
        error: "Task not found"
      })
    }

    const nextDepartmentIds = normalizeStringArray(departmentIds)
    const nextDepartmentId = normalizeString(departmentId) || nextDepartmentIds[0]

    task.name = normalizeString(name) || task.name
    if (nextDepartmentId) task.departmentId = nextDepartmentId
    if (nextDepartmentIds.length > 0) task.departmentIds = nextDepartmentIds
    task.phase = normalizeString(phase) || task.phase
    task.description = typeof description === "string" ? description.trim() : task.description
    task.supportingDoc = typeof supportingDoc === "string" ? supportingDoc.trim() : task.supportingDoc
    if (typeof isCftTask === "boolean") task.isCftTask = isCftTask
    if (typeof cftTeam === "string") task.cftTeam = cftTeam.trim()
    task.updatedAt = new Date()

    await task.save()

    // Return formatted response matching TaskTemplate interface
    res.json(formatTask(task))
  } catch (err) {
    console.error("Error updating task:", err)
    res.status(500).json({ error: err.message })
  }
}

exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.body

    if (!id) {
      return res.status(400).json({
        error: "Task id is required"
      })
    }

    const task = await Task.findOne({ id })

    if (!task) {
      return res.status(404).json({
        error: "Task not found"
      })
    }

    await Task.deleteOne({ id })

    res.json({ id, message: "Task deleted successfully" })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
