const express = require("express")
const router = express.Router()

const {getMoms,createMom,updateMom,updateMomAction} = require("../controllers/momController")

router.post("/list",getMoms)
router.post("/",createMom)
router.put("/:id", updateMom)
router.put("/:id/actions/:actionIndex", updateMomAction)


module.exports = router

