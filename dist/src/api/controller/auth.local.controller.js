"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginLocal = exports.registerLocal = void 0;
const User_1 = __importDefault(require("../../models/User"));
const jwt_1 = require("../utils/jwt");
const password_1 = require("../../services/auth/password");
const email_1 = require("../../services/auth/email");
const registerLocal = async (req, res, next) => {
    try {
        const { name, email, password } = req.body ?? {};
        if (!name || typeof name !== "string" || name.trim().length < 2) {
            return res.status(400).json({ message: "name is required." });
        }
        if (!email || typeof email !== "string") {
            return res.status(400).json({ message: "email is required." });
        }
        if (!password || typeof password !== "string" || password.length < 6) {
            return res.status(400).json({ message: "password must be at least 6 chars." });
        }
        const emailInfo = (0, email_1.canonicalizeEmail)(email);
        if (!emailInfo.raw)
            return res.status(400).json({ message: "email is required." });
        const existing = await User_1.default.findOne({
            where: { emailCanonical: emailInfo.canonical },
        });
        if (existing) {
            return res.status(409).json({ message: "User already exists." });
        }
        const passwordHash = await (0, password_1.hashPassword)(password);
        const user = await User_1.default.create({
            name: name.trim(),
            email: emailInfo.raw,
            emailCanonical: emailInfo.canonical,
            passwordHash,
            googleId: null,
            avatarUrl: null,
        });
        const token = (0, jwt_1.signToken)({ id: user.dataValues.id });
        return res.status(201).json({
            message: "Success",
            token,
            user: {
                id: user.dataValues.id,
                name: user.dataValues.name,
                email: user.dataValues.email,
                avatarUrl: user.dataValues.avatarUrl,
            },
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.registerLocal = registerLocal;
const loginLocal = async (req, res, next) => {
    try {
        const { email, password } = req.body ?? {};
        if (!email || typeof email !== "string") {
            return res.status(400).json({ message: "email is required." });
        }
        if (!password || typeof password !== "string") {
            return res.status(400).json({ message: "password is required." });
        }
        const emailInfo = (0, email_1.canonicalizeEmail)(email);
        if (!emailInfo.raw)
            return res.status(400).json({ message: "email is required." });
        const user = await User_1.default.findOne({
            where: { emailCanonical: emailInfo.canonical },
        });
        if (!user || !user.dataValues.passwordHash) {
            return res.status(403).json({ message: "Invalid email or password." });
        }
        const ok = await (0, password_1.verifyPassword)(password, user.dataValues.passwordHash);
        if (!ok) {
            return res.status(403).json({ message: "Invalid email or password." });
        }
        const token = (0, jwt_1.signToken)({ id: user.dataValues.id });
        return res.status(200).json({
            message: "Success",
            token,
            user: {
                id: user.dataValues.id,
                name: user.dataValues.name,
                email: user.dataValues.email,
                avatarUrl: user.dataValues.avatarUrl,
            },
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.loginLocal = loginLocal;
