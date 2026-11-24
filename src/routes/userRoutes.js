const express = require("express")
const router = express.Router()

const {
  listUsers,
  addUser,
  updateUser,
  toggleUserStatus,
  deleteUser
} = require("../controllers/organizationController")

router.post("/list", listUsers)
router.post("/add", addUser)
router.post("/update", updateUser)
router.post("/toggle-status",toggleUserStatus)
router.post("/delete", deleteUser)



module.exports = router
