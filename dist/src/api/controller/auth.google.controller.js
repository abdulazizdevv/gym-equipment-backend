"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authGoogle = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const User_1 = __importDefault(require("../../models/User"));
const jwt_1 = require("../utils/jwt");
const email_1 = require("../../services/auth/email");
const authGoogle = async (req, res, next) => {
    try {
        const body = req.body ?? {};
        const { idToken, googleId: bodyGoogleId, providerAccountId, email: bodyEmail, name: bodyName, avatarUrl: bodyAvatarUrl, user: bodyUser, } = body;
        let googleId = bodyGoogleId || providerAccountId;
        let email = bodyEmail || bodyUser?.email;
        let name = bodyName || bodyUser?.name;
        let avatarUrl = bodyAvatarUrl || bodyUser?.image;
        // If front sends `idToken`, decode it (verification later can be added).
        if (idToken && !googleId) {
            const decoded = (0, jsonwebtoken_1.decode)(idToken);
            googleId = decoded?.sub;
            email = decoded?.email;
            name = name ?? decoded?.name ?? decoded?.given_name;
            avatarUrl = avatarUrl ?? decoded?.picture ?? null;
        }
        if (!googleId) {
            return res.status(400).json({ message: "googleId or idToken is required." });
        }
        if (!name || typeof name !== "string" || name.trim().length === 0) {
            name = "User";
        }
        const emailInfo = typeof email === "string" && email.trim().length > 0
            ? (0, email_1.canonicalizeEmail)(email)
            : null;
        // If user already registered with email/password, link googleId to that user.
        if (emailInfo?.raw) {
            const byEmail = await User_1.default.findOne({
                where: { emailCanonical: emailInfo.canonical },
            });
            if (byEmail) {
                if (!byEmail.dataValues.googleId) {
                    await User_1.default.update({ googleId, avatarUrl: avatarUrl ?? byEmail.dataValues.avatarUrl }, { where: { id: byEmail.dataValues.id } });
                }
                const token = (0, jwt_1.signToken)({ id: byEmail.dataValues.id });
                return res.status(200).json({
                    message: "Success",
                    token,
                    user: {
                        id: byEmail.dataValues.id,
                        name: byEmail.dataValues.name,
                        email: byEmail.dataValues.email,
                        avatarUrl: avatarUrl ?? byEmail.dataValues.avatarUrl,
                    },
                });
            }
        }
        const [user] = await User_1.default.findOrCreate({
            where: { googleId },
            defaults: {
                name,
                email: emailInfo?.raw ? emailInfo.raw : null,
                emailCanonical: emailInfo?.raw ? emailInfo.canonical : null,
                avatarUrl: avatarUrl ?? null,
            },
        });
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
exports.authGoogle = authGoogle;
