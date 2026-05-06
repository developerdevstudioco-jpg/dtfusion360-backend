const express = require("express");
const path = require("path");
const router = express.Router();

// Serve logo for emails
router.get("/logo.png", (req, res) => {
  try {
    const logoPath = path.join(__dirname, "../../uploads/logo.png");
    res.sendFile(logoPath);
  } catch (error) {
    res.status(404).json({ error: "Logo not found" });
  }
});

module.exports = router;
