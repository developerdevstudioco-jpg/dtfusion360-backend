const Task = require("../models/Task")

exports.listTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
    const formattedTasks = tasks.map(task => ({
      id: task.id || task._id.toString(),
      name: task.name,
      departmentId: task.departmentId,
      phase: task.phase,
      description: task.description || "",
      supportingDoc: task.supportingDoc || ""
    }))
    res.json(formattedTasks)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.addTask = async (req, res) => {
  try {
    const { name, departmentId, phase, description, supportingDoc } = req.body

    if (!name || !departmentId || !phase) {
      return res.status(400).json({
        error: "Name, departmentId, and phase are required"
      })
    }

    const task = await Task.create({
      id: "TASK" + Date.now(),
      name,
      departmentId,
      phase,
      description: description || "",
      supportingDoc: supportingDoc || "",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Return formatted response matching TaskTemplate interface
    res.status(201).json({
      id: task.id,
      name: task.name,
      departmentId: task.departmentId,
      phase: task.phase,
      description: task.description || "",
      supportingDoc: task.supportingDoc || ""
    })
  } catch (err) {
    console.error("Error adding task:", err)
    res.status(500).json({ error: err.message })
  }
}

exports.updateTask = async (req, res) => {
  try {
    const { id, name, departmentId, phase, description, supportingDoc } = req.body

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

    task.name = name ?? task.name
    task.departmentId = departmentId ?? task.departmentId
    task.phase = phase ?? task.phase
    task.description = description ?? task.description
    task.supportingDoc = supportingDoc ?? task.supportingDoc
    task.updatedAt = new Date()

    await task.save()

    // Return formatted response matching TaskTemplate interface
    res.json({
      id: task.id,
      name: task.name,
      departmentId: task.departmentId,
      phase: task.phase,
      description: task.description || "",
      supportingDoc: task.supportingDoc || ""
    })
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
