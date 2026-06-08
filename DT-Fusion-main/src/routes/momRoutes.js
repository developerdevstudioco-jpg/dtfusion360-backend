const express = require("express")
const router = express.Router()

const {getMoms,createMom} = require("../controllers/momController")

router.post("/list",getMoms)
router.post("/",createMom)


module.exports = router


