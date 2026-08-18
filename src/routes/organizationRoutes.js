
const express=require("express")
const router=express.Router()

const {
listOrganization,
addPlant,
deletePlant,
updatePlant,
addDepartment,
updateDepartment,
addTeam,
updateTeam,
addUser,
updateUser,
listUsers,
toggleUserStatus,
deleteUser
}=require("../controllers/organizationController")

router.post("/list",listOrganization)

router.post("/plants/add",addPlant)
router.post("/plants/delete",deletePlant)
router.post("/plants/update",updatePlant)

router.post("/departments/add",addDepartment)
router.post("/departments/update",updateDepartment)

router.post("/teams/add",addTeam)
router.post("/teams/update",updateTeam)

router.post("/users/add", addUser)
router.post("/users/update", updateUser)
router.post("/users/toggle-status",toggleUserStatus)
router.post("/users/delete", deleteUser)

module.exports=router
