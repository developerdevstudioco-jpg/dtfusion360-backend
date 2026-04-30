const express = require("express")
const router = express.Router()

const {getMoms,createMom} = require("../controllers/momController")

router.get("/",getMoms)
router.post("/",createMom)


module.exports = router


