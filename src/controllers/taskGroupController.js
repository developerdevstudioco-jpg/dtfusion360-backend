const TaskGroup = require("../models/TaskGroup");

const formatGroup = (group) => ({
  id: group.id,
  name: group.name,
  phase: group.phase,
  taskIds: group.taskIds || [],
});

exports.listTaskGroups = async (req, res) => {
  try {
    const groups = await TaskGroup.find({ isActive: true });
    const formatted = groups.map(formatGroup);
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addTaskGroup = async (req, res) => {
  try {
    const { id, name, phase, taskIds } = req.body;

    if (!id || !name || !phase) {
      return res.status(400).json({ error: "id, name, and phase are required" });
    }

    const group = await TaskGroup.create({
      id,
      name: name.trim(),
      phase,
      taskIds: Array.isArray(taskIds) ? taskIds : [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json(formatGroup(group));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTaskGroup = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }

    const group = await TaskGroup.findOne({ id });

    if (!group) {
      return res.status(404).json({ error: "Task group not found" });
    }

    await TaskGroup.deleteOne({ id });

    res.json({ id, message: "Task group deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
