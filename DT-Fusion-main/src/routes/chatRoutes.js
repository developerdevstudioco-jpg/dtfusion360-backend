const express = require("express")
const router = express.Router()

const auth = require("../middleware/auth")
const {
  getContacts,
  getMessages,
  uploadMedia
} = require("../controllers/chatController")

// ✅ Matches FE EXACTLY
router.get("/contacts", auth, getContacts)
router.get("/messages/:conversationId", auth, getMessages)
router.post("/media", auth, uploadMedia)

module.exports = router