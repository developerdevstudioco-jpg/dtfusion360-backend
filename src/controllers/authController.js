const User = require("../models/Users")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { presentUser } = require("../utils/userPresenter")

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/

const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET || "secretkey")
    } catch (error) {
        return null
    }
}

exports.login = async(req,res)=>{
    try{
        const {username,password} = req.body
        const user  = await User.findOne({email:username})
        if(!user)
        {
            return res.status(400).json({
                message: "Invalid email or password"
            })
        }

        if (user.isActive === false) {
            return res.status(403).json({
                message: "User is inactive"
            })
        }

        const isMatch = await bcrypt.compare(password,user.password)

        if(!isMatch)
        {
            return res.status(400).json({
                message: "Invalid email or password"
            })
        }
        const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || "secretkey",
        { expiresIn: "1d" }
        )
        const presentedUser = await presentUser(user)
        res.json({
            token,
            user: presentedUser,
            mustChangePassword: Boolean(user.mustChangePassword)
        })
    }

    catch(err){
        res.status(500).json({
            message:err.message
        })
    }
}

exports.changePassword = async (req, res) => {
    try {
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "No token provided"
            })
        }

        const decoded = verifyToken(authHeader.substring(7))

        if (!decoded) {
            return res.status(401).json({
                message: "Invalid token"
            })
        }

        const { newPassword, currentPassword } = req.body

        if (typeof newPassword !== "string" || !PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
            })
        }

        const user = await User.findById(decoded.id)

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        if (user.isActive === false) {
            return res.status(403).json({
                message: "User is inactive"
            })
        }

        if (!user.mustChangePassword) {
            if (typeof currentPassword !== "string" || currentPassword.length === 0) {
                return res.status(400).json({
                    message: "Current password is required"
                })
            }

            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)

            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    message: "Current password is incorrect"
                })
            }
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password)

        if (isSamePassword) {
            return res.status(400).json({
                message: "New password must be different from the current password"
            })
        }

        user.password = await bcrypt.hash(newPassword, 10)
        user.mustChangePassword = false
        await user.save()

        res.json({
            message: "Password updated successfully",
            user: await presentUser(user)
        })
    } catch (err) {
        res.status(500).json({
            message: err.message
        })
    }
}
