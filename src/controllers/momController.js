const Mom = require("../models/Mom")

//Get

exports.getMoms = async(req, res)=>{
    try{
        const moms = await Mom.find()
        res.json(moms)
    }
    catch(err)
    {
        res.status(500).json({message:err.message})
    }
}

//Post 

exports.createMom = async(req,res)=>{
    try{
        const mom = await Mom.create(req.body)
        res.json(mom)
    }
    catch(err)
    {
        res.status(500).json({message:err.message})
    }
}
