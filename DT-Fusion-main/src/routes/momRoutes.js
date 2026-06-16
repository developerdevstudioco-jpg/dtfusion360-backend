const express = require("express")
const router = express.Router()

const {getMoms,createMom,updateMom} = require("../controllers/momController")

router.post("/list",getMoms)
router.post("/",createMom)
router.put("/:id", updateMom)


module.exports = router


