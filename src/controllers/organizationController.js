
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

exports.listOrganization = async (req, res) => {
  try {

    const plants = await Plant.find() || []
    const departments = await Department.find() || []
    const teams = await Team.find() || []
    const users = await User.find() || []

    res.json({
      plants,
      departments,
      teams,
      users
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
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
      plantIds: req.body.plantIds || [],
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
    res.status(500).json({ error: err.message })
  }
}

exports.updateUser = async (req, res) => {
  try {

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
    user.plantIds = req.body.plantIds ?? user.plantIds
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
    res.status(500).json({ error: err.message })
  }
}



exports.listUsers = async (req, res) => {
  try {

    const plantIds = normalizeStringArray(req.body.plantIds)
    const resolvedPlantAssignments = await resolvePlantAssignments(plantIds)
    const query = resolvedPlantAssignments.length > 0
      ? {
        $or: [
          { plantIds: { $in: resolvedPlantAssignments } },
          { plant: { $in: resolvedPlantAssignments } }
        ]
      }
      : {}
    const users = await User.find(query)

    res.json(users)

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.toggleUserStatus = async (req, res) => {
  
  try {

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

    const managers = await User.find({ role: "Manager" })

    const formatted = managers.map(m => m.name)
    res.json(formatted)

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "secretkey");
  } catch (err) {
    return null;
  }
};

// Delete user with role-based access control
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'User id is required' });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get the current user making the request
    const currentUser = await findUserByIdentifier(String(decoded.id));
    if (!currentUser) {
      return res.status(401).json({ message: 'User not found' });
    }

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
