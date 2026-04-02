"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authAdmin = void 0;
const Admin_1 = __importDefault(require("../../models/Admin"));
const jwt_1 = require("../utils/jwt");
const authAdmin = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin_1.default.findOne({ where: { username, password } });
        if (!admin)
            return res.status(403).json({ message: "Invalid email or password" });
        const token = (0, jwt_1.signToken)({ id: admin.dataValues.id });
        res.status(200).json({ message: "Success", token: token });
    }
    catch (error) {
        next(error);
    }
};
exports.authAdmin = authAdmin;
