"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUser = void 0;
const jwt_1 = require("../api/utils/jwt");
const User_1 = __importDefault(require("../models/User"));
const requireUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const decoded = (0, jwt_1.verifyToken)(token);
        if (!decoded?.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        console.log(`[Middleware] Checking user in DB for ID: ${decoded.id}`);
        const start = Date.now();
        const user = await User_1.default.findByPk(decoded.id);
        const duration = Date.now() - start;
        console.log(`[Middleware] DB query finished in ${duration}ms`);
        if (!user) {
            console.warn(`[Middleware] User not found in DB: ${decoded.id}`);
            return res.status(401).json({ message: "Unauthorized: User not found in database" });
        }
        req.userId = decoded.id;
        return next();
    }
    catch (error) {
        return res.status(401).json({ message: "Unauthorized" });
    }
};
exports.requireUser = requireUser;
