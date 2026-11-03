const express = require("express");
const path = require("path");
const router = express.Router();

// Serve logo for emails
router.get("/logo.png", (req, res) => {
  try {
    const logoPath = path.join(__dirname, "../../build/assets/logo.png");
    res.sendFile(logoPath);
  } catch (error) {
    // Fallback: return a data URI or error message
    res.status(404).json({ error: "Logo not found" });
  }
});

// Serve any static asset
router.get("/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    // Security: prevent directory traversal
    if (filename.includes("..") || filename.includes("/")) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    
    const filePath = path.join(__dirname, "../../build", filename);
    res.sendFile(filePath);
  } catch (error) {
    res.status(404).json({ error: "File not found" });
  }
});

module.exports = router;
