
const Plant=require("../models/Plant")
const Department=require("../models/Department")
const Team=require("../models/Team")
const User = require("../models/Users")
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs/dist/bcrypt")
const jwt = require("jsonwebtoken")
const { sendAccountCreationEmail } = require("../services/accountEmailService")

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value]
  }

  return []
}

const normalizeRole = (role) => {
  if (typeof role !== "string") {
    return ""
  }

  return role.replace(/\s+/g, "").toLowerCase()
}

const isSuperAdminRole = (role) => normalizeRole(role) === "superadmin"

const isPlantAdminRole = (role) => normalizeRole(role) === "plantadmin"

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "secretkey")
  } catch (err) {
    return null
  }
}

const generateTemporaryPassword = () => {
  const randomFragment = Math.random().toString(36).slice(-6)
  return `Dt@${Date.now().toString().slice(-4)}${randomFragment}A1`
}

const findUserByIdentifier = async (identifier) => {
  if (!identifier || typeof identifier !== "string") {
    return null
  }

  let user = await User.findOne({ id: identifier })

  if (!user && mongoose.isValidObjectId(identifier)) {
    user = await User.findById(identifier)
  }

  if (!user) {
    user = await User.findOne({
      $or: [
        { email: identifier },
        { employeeCode: identifier }
      ]
    })
  }

  return user
}

const getCurrentUserFromRequest = async (req) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw Object.assign(new Error("No token provided"), { statusCode: 401 })
  }

  const decoded = verifyToken(authHeader.substring(7))

  if (!decoded) {
    throw Object.assign(new Error("Invalid token"), { statusCode: 401 })
  }

  const currentUser = await findUserByIdentifier(String(decoded.id))

  if (!currentUser) {
    throw Object.assign(new Error("User not found"), { statusCode: 401 })
  }

  if (currentUser.isActive === false) {
    throw Object.assign(new Error("User is inactive"), { statusCode: 403 })
  }

  return currentUser
}

const resolvePlantAssignments = async (assignments) => {
  const normalizedAssignments = normalizeStringArray(assignments)

  if (normalizedAssignments.length === 0) {
    return []
  }

  const matchedPlants = await Plant.find({
    $or: [
      { id: { $in: normalizedAssignments } },
      { name: { $in: normalizedAssignments } }
    ]
  }).select("id name")

  const resolvedPlantIds = matchedPlants.map((plant) => plant.id)
  const matchedAssignments = new Set(matchedPlants.flatMap((plant) => [plant.id, plant.name]))

  return [...new Set([
    ...resolvedPlantIds,
    ...normalizedAssignments.filter((assignment) => !matchedAssignments.has(assignment))
  ])]
}

const getScopedPlantIds = async (currentUser, requestedPlantIds = []) => {
  if (isSuperAdminRole(currentUser.role)) {
    return resolvePlantAssignments(requestedPlantIds)
  }

  const currentUserPlants = await resolvePlantAssignments(currentUser.plantIds ?? currentUser.plant)
  const requestedPlants = await resolvePlantAssignments(requestedPlantIds)

  if (requestedPlants.length === 0) {
    return currentUserPlants
  }

  return requestedPlants.filter((plantId) => currentUserPlants.includes(plantId))
}

const createPlantScopedUserQuery = (plantIds) => ({
  $or: [
    { plantIds: { $in: plantIds } },
    { plant: { $in: plantIds } }
  ]
})

const canManageUserInScope = async (currentUser, targetUser) => {
  if (isSuperAdminRole(currentUser.role)) {
    return true
  }

  if (!isPlantAdminRole(currentUser.role)) {
    return false
  }

  const currentUserPlants = await resolvePlantAssignments(currentUser.plantIds ?? currentUser.plant)
  const targetUserPlants = await resolvePlantAssignments(targetUser.plantIds ?? targetUser.plant)

  return targetUserPlants.some((plantId) => currentUserPlants.includes(plantId))
}

exports.listOrganization = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const scopedPlantIds = await getScopedPlantIds(currentUser)
    const isSuperAdmin = isSuperAdminRole(currentUser.role)

    const plants = await Plant.find(isSuperAdmin ? {} : { id: { $in: scopedPlantIds } }) || []
    const departments = await Department.find(isSuperAdmin ? {} : { plantId: { $in: scopedPlantIds } }) || []
    const departmentIds = departments.map((department) => department.id)
    const teams = await Team.find(isSuperAdmin ? {} : { departmentId: { $in: departmentIds } }) || []
    const users = await User.find(isSuperAdmin ? {} : createPlantScopedUserQuery(scopedPlantIds)) || []

    res.json({
      plants,
      departments,
      teams,
      users
    })

  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

//exports.addPlant=async(req,res)=>{

//const plant=await Plant.create(req.body)
//res.json(plant)

//}
exports.addPlant = async (req, res) => {
  try {

    const rawPlantCode = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    const plantName = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!plantName) {
      return res.status(400).json({ error: 'Plant name is required.' });
    }

    if (!rawPlantCode) {
      return res.status(400).json({ error: 'Plant code is required.' });
    }

    if (!/^[A-Z0-9-]+$/.test(rawPlantCode.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid plant code. Use uppercase letters, numbers and hyphens only.' });
    }

    if (!/^[a-zA-Z\s&'().-]+$/.test(plantName)) {
      return res.status(400).json({ error: 'Invalid plant name. Only letters, spaces and &\'()-. are allowed.' });
    }

    const plantCode = rawPlantCode.toUpperCase();
    const existingPlantCode = await Plant.findOne({ code: plantCode });
    if (existingPlantCode) {
      return res.status(400).json({ error: `Plant code '${plantCode}' is already in use.` });
    }

    const existingPlantName = await Plant.findOne({ name: plantName });
    if (existingPlantName) {
      return res.status(400).json({ error: `Plant name '${plantName}' is already in use.` });
    }

    const count = await Plant.countDocuments();
    let plant;
    try {
      plant = await Plant.create({
        id: "PLANT" + String(count + 1).padStart(3, "0"),
        code: plantCode,
        name: plantName,
        location: req.body.location,
        isActive: req.body.isActive ?? true
      });
    } catch (createError) {
      const message = createError.code === 11000
        ? 'Duplicate plant code or id detected.'
        : createError.message;
      return res.status(400).json({ error: message });
    }

    // Auto-create standard departments for the new plant
    const departments = [
      { shortCode: 'Marketing', name: 'Marketing Department' },
      { shortCode: 'Sales', name: 'Sales Department' },
      { shortCode: 'R&D', name: 'Research & Development Department' },
      { shortCode: 'NPD', name: 'New Product Development Department' },
      { shortCode: 'Quality', name: 'Quality Department' },
      { shortCode: 'Stores', name: 'Stores Department' },
      { shortCode: 'Purchase', name: 'Purchase Department' },
      { shortCode: 'Maintenance', name: 'Maintenance Department' },
      { shortCode: 'PED', name: 'Process Engineering Department' },
      { shortCode: 'PPC', name: 'Production Planning & Control Department' },
      { shortCode: 'Production', name: 'Production Department' },
      { shortCode: 'HR', name: 'Human Resources Department' },
      { shortCode: 'Training', name: 'Training Department' },
      { shortCode: 'QHSE', name: 'Quality, Health, Safety & Environment Department' },
      { shortCode: 'Accounts', name: 'Accounts Department' },
      { shortCode: 'SCM', name: 'Supply Chain Management Department' },
      { shortCode: 'CCVD', name: 'Corporate Crimp Validation Department' }
    ];

    const createdDepartments = [];

    for (let i = 0; i < departments.length; i++) {
      const dept = departments[i];
      const deptCode = `${plant.code}-${dept.shortCode}`;

      const department = await Department.create({
        id: "DEP" + Date.now() + i,
        code: deptCode,
        name: dept.name,
        plantId: plant.id,
        isActive: true
      });

      createdDepartments.push(department);
    }

    res.json({
      plant: plant,
      departments: createdDepartments,
      message: `Plant created successfully with ${createdDepartments.length} standard departments`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePlant = async (req, res) => {
  try {
    const plantId = req.body.id || req.body.plantId || req.query.id || req.params.id;
    if (!plantId) {
      return res.status(400).json({ error: 'Plant id is required to delete a plant.' });
    }

    const plant = await Plant.findOne({ id: plantId });
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found.' });
    }

    const departments = await Department.find({ plantId: plant.id });
    const departmentIds = departments.map((dept) => dept.id);

    await Department.deleteMany({ plantId: plant.id });
    await Team.deleteMany({ departmentId: { $in: departmentIds } });
    await Plant.deleteOne({ id: plant.id });

    res.json({ plantId: plant.id, deletedDepartmentIds: departmentIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePlant = async (req, res) => {
  try {

    const plant = await Plant.findOneAndUpdate(
      { id: req.body.id },
      req.body,
      { new: true }
    );

    if (!plant) {
      return res.status(404).json({
        error: "Plant not found",
        id: req.body.id
      });
    }

    res.json(plant);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
//exports.addDepartment=async(req,res)=>{

//const department=await Department.create(req.body)
//res.json(department)

//}
exports.addDepartment = async (req, res) => {
  try {

    const plant = await Plant.findOne({ id: req.body.plantId });

    if (!plant) {
      return res.status(400).json({
        error: "Plant not found for plantId: " + req.body.plantId
      });
    }

    // count existing departments for this plant
    const deptCount = await Department.countDocuments({
      plantId: req.body.plantId
    });

    // generate sequential code
    const deptCode =
      plant.code +
      "-DEP" +
      String(deptCount + 1).padStart(3, "0");

    const department = await Department.create({
      id: "DEP" + Date.now(),
      code: deptCode,
      name: req.body.name,
      plantId: req.body.plantId,
      isActive: req.body.isActive ?? true
    });

    res.json(department);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {

    const department = await Department.findOne({ id: req.body.id });

    if (!department) {
      return res.status(404).json({
        error: "Department not found",
        id: req.body.id
      });
    }

    department.name = req.body.name ?? department.name;
    department.plantId = req.body.plantId ?? department.plantId;
    department.isActive = req.body.isActive ?? department.isActive;

    await department.save();

    res.json(department);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//exports.addTeam=async(req,res)=>{

//const team=await Team.create(req.body)
//res.json(team)

//}

exports.addTeam = async (req, res) => {
  try {

    const department = await Department.findOne({ id: req.body.departmentId });
    if (!department) {
      return res.status(400).json({
        error: "Department not found for departmentId: " + req.body.departmentId
      });
    }

    const teamCount = await Team.countDocuments({ departmentId: req.body.departmentId });

    const team = await Team.create({
      id: "TEAM" + Date.now(),
      code: `${department.code}-T${String(teamCount + 1).padStart(2,"0")}`,
      name: req.body.name,
      departmentId: req.body.departmentId,
      isActive: req.body.isActive ?? true
    });

    res.json(team);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTeam = async (req, res) => {
  try {

    const team = await Team.findOne({ id: req.body.id });

    if (!team) {
      return res.status(404).json({
        error: "Team not found"
      });
    }

    team.name = req.body.name ?? team.name
    team.departmentId = req.body.departmentId ?? team.departmentId
    team.isActive = req.body.isActive ?? team.isActive

    await team.save()

    res.json(team);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
//add user
exports.addUser = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const requestedPlantIds = await resolvePlantAssignments(req.body.plantIds)

    if (!isSuperAdminRole(currentUser.role)) {
      if (!isPlantAdminRole(currentUser.role)) {
        return res.status(403).json({ error: "Insufficient permissions to add users" })
      }

      if (isSuperAdminRole(req.body.role)) {
        return res.status(403).json({ error: "Only SuperAdmin can create SuperAdmin accounts" })
      }

      const scopedPlantIds = await getScopedPlantIds(currentUser, requestedPlantIds)

      if (requestedPlantIds.length === 0 || scopedPlantIds.length !== requestedPlantIds.length) {
        return res.status(403).json({ error: "Plant Admin can only add users within their own plants" })
      }
    }

    const requestedPassword = typeof req.body.password === "string" ? req.body.password.trim() : ""
    const temporaryPassword = requestedPassword || generateTemporaryPassword()

    if (!PASSWORD_COMPLEXITY_REGEX.test(temporaryPassword)) {
      return res.status(400).json({
        error: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
      })
    }

    const hashedPassword = await bcrypt.hash(temporaryPassword,10)
    const user = await User.create({
      id: req.body.id,
      name: req.body.name,
      email: req.body.email,
      employeeCode:req.body.employeeCode,
      mobile: req.body.mobile,
      password:hashedPassword,
      role: req.body.role,
      plantIds: requestedPlantIds,
      departmentIds: req.body.departmentIds || [],
      teams: req.body.teams || [],
      isActive: req.body.isActive ?? true,
      mustChangePassword: true
    })

    const emailDelivery = await sendAccountCreationEmail({
      to: user.email,
      username: user.email,
      password: temporaryPassword,
    })

    res.status(201).json({
      user: user.toJSON(),
      email: emailDelivery
    })

  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

exports.updateUser = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)

    let user = await User.findOne({ id: req.body.id })

    if (!user) {
      user = await User.findById(req.body.id)
    }

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        id: req.body.id
      })
    }

    const hasScope = await canManageUserInScope(currentUser, user)

    if (!hasScope) {
      return res.status(403).json({
        error: "You can only update users within your own plant scope"
      })
    }

    const nextPlantIds = req.body.plantIds ? await resolvePlantAssignments(req.body.plantIds) : user.plantIds

    if (!isSuperAdminRole(currentUser.role)) {
      if (req.body.role && isSuperAdminRole(req.body.role)) {
        return res.status(403).json({
          error: "Only SuperAdmin can assign SuperAdmin role"
        })
      }

      const scopedPlantIds = await getScopedPlantIds(currentUser, nextPlantIds)

      if (scopedPlantIds.length !== normalizeStringArray(nextPlantIds).length) {
        return res.status(403).json({
          error: "Users cannot be assigned to plants outside your scope"
        })
      }
    }

    if (isSuperAdminRole(user.role)) {
      return res.status(403).json({
        error: "SuperAdmin accounts cannot be edited"
      })
    }

    user.name = req.body.name ?? user.name
    user.email = req.body.email ?? user.email
    user.role = req.body.role ?? user.role
    user.employeeCode = req.body.employeeCode?? user.employeeCode
    user.mobile = req.body.mobile ?? user.mobile
    user.plantIds = nextPlantIds
    user.departmentIds = req.body.departmentIds ?? user.departmentIds
    user.teams = req.body.teams ?? user.teams
    user.isActive = req.body.isActive ?? user.isActive

    if (req.body.password) {
      if (!PASSWORD_COMPLEXITY_REGEX.test(req.body.password)) {
        return res.status(400).json({
          error: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
        })
      }

      user.password = await bcrypt.hash(req.body.password,10)
      user.mustChangePassword = req.body.clearPasswordChangeRequirement === true ? false : true
    }

    await user.save()

    res.json(user)

  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}



exports.listUsers = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const plantIds = normalizeStringArray(req.body.plantIds)
    const resolvedPlantAssignments = await getScopedPlantIds(currentUser, plantIds)
    const query = isSuperAdminRole(currentUser.role) && resolvedPlantAssignments.length === 0
      ? {}
      : resolvedPlantAssignments.length > 0
      ? createPlantScopedUserQuery(resolvedPlantAssignments)
      : { _id: { $exists: false } }
    const users = await User.find(query)

    res.json(users)

  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

exports.toggleUserStatus = async (req, res) => {
  
  try {
    const currentUser = await getCurrentUserFromRequest(req)

    const { id } = req.body

    let user = await User.findOne({ id })

    if (!user) {
      user = await User.findById(id)
    }

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      })
    }

    const hasScope = await canManageUserInScope(currentUser, user)

    if (!hasScope || currentUser._id.toString() === user._id.toString()) {
      return res.status(403).json({
        message: "You can only update users within your own plant scope"
      })
    }

    if (isSuperAdminRole(user.role)) {
      return res.status(403).json({
        message: "SuperAdmin accounts cannot be edited"
      })
    }

    user.isActive = !user.isActive
    await user.save()

    // return updated user object
    res.json(user)

  } catch (err) {
    res.status(500).json({
      message: err.message
    })
  }
}

exports.listManagers = async (req, res) => {
  try {
    const managers = await User.find({
      role: /manager/i,
      isActive: true
    }).select("name employeeCode")

    // 🔥 FIX employeeCode corruption if exists
    const formatted = managers.map(m => {
      const name = m.name ||
        (Array.isArray(m.employeeCode) ? m.employeeCode[0] : m.employeeCode)

      return name
    })

    console.log("✅ FINAL MANAGER LIST:", formatted)

    res.json(formatted)

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
// Delete user with role-based access control
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'User id is required' });
    }

    const currentUser = await getCurrentUserFromRequest(req);

    // Get the target user to be deleted
    const targetUser = await findUserByIdentifier(id);

    if (!targetUser) {
      return res.status(404).json({ message: 'User to delete not found' });
    }

    if (isSuperAdminRole(targetUser.role)) {
      return res.status(403).json({ message: 'SuperAdmin accounts cannot be deleted' });
    }

    // Prevent users from deleting themselves
    if (currentUser._id.toString() === targetUser._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Role-based access control
    if (isSuperAdminRole(currentUser.role)) {
      // SuperAdmin can delete any user
    } else if (isPlantAdminRole(currentUser.role)) {
      // PlantAdmin can only delete users within their plants
      const currentUserPlants = await resolvePlantAssignments(currentUser.plantIds ?? currentUser.plant);
      const targetUserPlants = await resolvePlantAssignments(targetUser.plantIds ?? targetUser.plant);

      const hasCommonPlant = currentUserPlants.some(plantId =>
        targetUserPlants.includes(plantId)
      );

      if (!hasCommonPlant) {
        return res.status(403).json({
          message: 'Plant Admin can only delete users within their own plants'
        });
      }
    } else {
      // Other roles cannot delete users
      return res.status(403).json({
        message: 'Insufficient permissions to delete users'
      });
    }

    // Perform the deletion
    const deletedUser = await User.findByIdAndDelete(targetUser._id);

    if (!deletedUser) {
      return res.status(404).json({ message: 'User already deleted or not found' });
    }

    res.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: deletedUser.id,
        name: deletedUser.name,
        email: deletedUser.email
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
