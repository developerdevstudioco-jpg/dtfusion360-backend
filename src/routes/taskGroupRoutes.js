const express = require("express");
const {
  listTaskGroups,
  addTaskGroup,
  deleteTaskGroup,
} = require("../controllers/taskGroupController");

const router = express.Router();

router.post("/list", listTaskGroups);
router.post("/add", addTaskGroup);
router.post("/delete", deleteTaskGroup);

module.exports = router;
