"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = void 0;
const User_1 = __importDefault(require("../../models/User"));
const getMe = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const start = Date.now();
        const user = await User_1.default.findOne({ where: { id: userId } });
        const duration = Date.now() - start;
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({
            id: user.dataValues.id,
            name: user.dataValues.name,
            email: user.dataValues.email,
            avatarUrl: user.dataValues.avatarUrl,
            createdAt: user.dataValues.createdAt,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getMe = getMe;
