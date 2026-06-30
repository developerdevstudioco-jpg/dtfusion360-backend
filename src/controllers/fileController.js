const Folder = require("../models/FileManager")
const path = require("path")
const fs = require("fs")

// ------------------ LIST ------------------
exports.listFiles = async (req, res) => {
  try {
    const folders = await Folder.find()
    res.json(folders)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ------------------ CREATE FOLDER ------------------
exports.createFolder = async (req, res) => {
  try {
    const folder = await Folder.create({
      name: req.body.name,
      department: req.body.department,
      subdomains: []
    })

    res.json(folder)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ------------------ CREATE SUBDOMAIN ------------------
exports.createSubdomain = async (req, res) => {
  try {

    const folder = await Folder.findById(req.body.folderId)
    if (!folder) return res.status(404).json({ message: "Folder not found" })

    const subdomain = {
      name: req.body.name,
      files: []
    }

    folder.subdomains.push(subdomain)
    await folder.save()

    res.json(folder.subdomains[folder.subdomains.length - 1])

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ------------------ UPLOAD FILE ------------------
exports.uploadFile = async (req, res) => {
  try {
    console.log("========== UPLOAD START ==========")

    console.log("BODY:", req.body)
    console.log("FILE:", req.file)

    if (!req.file) {
      console.error("❌ File not received")
      return res.status(400).json({ message: "File not received" })
    }

    const { folderId, subdomainId } = req.body
    const parsed = JSON.parse(req.body.fileData || "{}")

    console.log("Parsed FE Data:", parsed)

    const folder = await Folder.findById(folderId)
    console.log("Folder Found:", folder?._id)

    if (!folder) {
      console.error("❌ Folder not found")
      return res.status(404).json({ message: "Folder not found" })
    }

    const subdomain = folder.subdomains.find(
      sd => sd._id.toString() === subdomainId
    )

    console.log("Subdomain Found:", subdomain?._id)

    if (!subdomain) {
      console.error("❌ Subdomain not found")
      return res.status(404).json({ message: "Subdomain not found" })
    }

    const newFile = {
      id: parsed.id,
      name: req.file.originalname,
      category: "general",
      department: "",
      revisions: [
        {
          id: parsed?.revisions?.[0]?.id,
          fileName: req.file.originalname,
          filePath: req.file.path,
          revision: "v1",
          uploadedBy: "system",
          uploadedDate: new Date().toISOString().split("T")[0],
          isLatest: true,
          fileType: req.file.mimetype
        }
      ]
    }

    console.log("New File Object:", newFile)

    subdomain.files.push(newFile)

    console.log("Saving folder...")

    await folder.save()

    console.log("✅ Upload saved successfully")

    console.log("========== UPLOAD END ==========")

    res.json({ message: "File uploaded", file: newFile })

  } catch (err) {
    console.error("❌ UPLOAD ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}


// ------------------ ADD REVISION ------------------
exports.addRevision = async (req, res) => {
  try {
    console.log("========== REVISION START ==========")

    const { folderId, subdomainId, fileId } = req.body
    const parsed = JSON.parse(req.body.fileData || "{}")

    console.log("BODY:", req.body)
    console.log("Parsed:", parsed)

    const folder = await Folder.findById(folderId)
    console.log("Folder:", folder?._id)

    const subdomain = folder?.subdomains.find(
      sd => sd._id.toString() === subdomainId
    )

    console.log("Subdomain:", subdomain?._id)

    const file = subdomain?.files.find(
      f => f._id.toString() === fileId || f.id === fileId
    )

    console.log("File matched:", file?.name)

    if (!file) {
      console.error("❌ File not found")
      return res.status(404).json({ message: "File not found" })
    }

    file.revisions.forEach(r => r.isLatest = false)

    const newRevision = {
      id: parsed?.revisionId || Date.now().toString(),
      fileName: req.file.originalname,
      filePath: req.file.path,
      revision: "v" + (file.revisions.length + 1),
      uploadedBy: "system",
      uploadedDate: new Date().toISOString().split("T")[0],
      isLatest: true,
      fileType: path.extname(req.file.originalname)
    }

    console.log("New Revision:", newRevision)

    file.revisions.push(newRevision)

    await folder.save()

    console.log("✅ Revision saved")

    console.log("========== REVISION END ==========")

    res.json({ message: "Revision saved", revision: newRevision })

  } catch (err) {
    console.error("❌ REVISION ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}


// ------------------ DOWNLOAD FILE ------------------
exports.downloadFile = async (req, res) => {
  try {
    console.log("========== DOWNLOAD START ==========")
    console.log("PARAMS:", req.query)

    const { folderId, subdomainId, fileId, revisionId } = req.query

    // 🔹 Step 1: Get folder
    const folder = await Folder.findById(folderId)
    console.log("Folder:", folder?._id)

    if (!folder) {
      console.error("❌ Folder not found")
      return res.status(404).json({ message: "Folder not found" })
    }

    // 🔹 Step 2: Get subdomain
    const subdomain = folder.subdomains.find(
      sd => sd._id.toString() === subdomainId
    )

    console.log("Subdomain:", subdomain?._id)

    if (!subdomain) {
      console.error("❌ Subdomain not found")
      return res.status(404).json({ message: "Subdomain not found" })
    }

    // 🔹 Step 3: List all files (debug)
    console.log("Available Files:", subdomain.files.map(f => ({
      mongoId: f._id,
      feId: f.id,
      name: f.name
    })))

    // 🔹 Step 4: Match file (Mongo + FE ID)
    let file = subdomain.files.find(
      f => f._id.toString() === fileId || f.id === fileId
    )

    console.log("Matched File:", file?.name)

    // 🔹 fallback: find file using revisionId
    if (!file) {
      console.warn("⚠️ File not matched, trying revision-based match...")

      file = subdomain.files.find(f =>
        f.revisions?.some(r =>
          r._id?.toString() === revisionId ||
          r.id === revisionId
        )
      )
    }

    if (!file) {
      console.error("❌ File not found")
      return res.status(404).json({ message: "File not found" })
    }

    // 🔹 Step 5: List revisions
    console.log("Available Revisions:", file.revisions.map(r => ({
      mongoId: r._id,
      feId: r.id,
      version: r.revision,
      hasPath: !!r.filePath
    })))

    // 🔹 Step 6: Match revision
    let revision = file.revisions.find(
      r =>
        r._id?.toString() === revisionId ||
        r.id === revisionId ||
        r.revision === revisionId
    )

    console.log("Matched Revision:", revision)

    // 🔹 Step 7: Fallback if revision missing OR broken
    if (!revision || !revision.filePath) {
      console.warn("⚠️ Revision missing or has no filePath, finding valid revision...")

      const validRevision = file.revisions
        .filter(r => r.filePath)
        .sort((a, b) => new Date(b.uploadedDate) - new Date(a.uploadedDate))[0]

      if (!validRevision) {
        console.error("❌ No valid revision found")
        return res.status(404).json({
          message: "No valid file available"
        })
      }

      console.log("✅ Using fallback revision:", validRevision)
      revision = validRevision
    }

    // 🔹 Step 8: Resolve file path
    const filePath = path.resolve(revision.filePath)

    console.log("Resolved Path:", filePath)

    // 🔹 Step 9: Check file exists
    if (!fs.existsSync(filePath)) {
      console.error("❌ File missing on server")
      return res.status(404).json({
        message: "File missing on server",
        path: filePath
      })
    }

    console.log("✅ Download success")

    return res.download(filePath)

  } catch (err) {
    console.error("❌ DOWNLOAD ERROR:", err)
    return res.status(500).json({
      message: "Download failed",
      error: err.message
    })
  }
}





exports.getPendingFiles = async (req, res) => {
  try {
    const { employeeCode } = req.body || {};

    const folders = await Folder.find();

    const pendingFiles = [];

    folders.forEach(folder => {
      folder.subdomains?.forEach(sub => {
        sub.files?.forEach(file => {
          file.revisions?.forEach(rev => {

            // adjust condition if you have approvalStatus
            if (rev.approvalStatus === "pending") {
              pendingFiles.push({
                id: rev._id?.toString(),
                fileName: rev.fileName,
                status: rev.approvalStatus || "pending",
                uploadedBy: rev.uploadedBy,
                createdAt: rev.uploadedDate,
                folderId: folder._id,
                subdomainId: sub._id,
                fileId: file._id
              });
            }

          });
        });
      });
    });

    return res.status(200).json(pendingFiles);

  } catch (err) {
    console.error("PENDING FILES ERROR:", err);
    return res.status(200).json([]); // FE safe
  }
};