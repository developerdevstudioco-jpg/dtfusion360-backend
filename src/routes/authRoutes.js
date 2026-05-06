const express = require("express")
const router = express.Router()

const {login, changePassword, requestPasswordReset} = require("../controllers/authController")

router.post("/login",login)
router.post("/change-password", changePassword)
router.post("/request-password-reset", requestPasswordReset)

module.exports = router
