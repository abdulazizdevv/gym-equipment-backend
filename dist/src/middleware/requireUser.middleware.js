"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUser = void 0;
const jwt_1 = require("../api/utils/jwt");
const requireUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;
        if (!token) {
            console.warn("[Middleware] No token provided");
            return res.status(401).json({ message: "Unauthorized: No token" });
        }
        const decoded = (0, jwt_1.verifyToken)(token);
        if (!decoded?.id) {
            console.warn("[Middleware] Invalid token payload");
            return res.status(401).json({ message: "Unauthorized: Invalid token" });
        }
        // Success: Pass to controller
        console.log(`[Middleware] Auth success for User ID: ${decoded.id}`);
        req.userId = decoded.id;
        return next();
    }
    catch (error) {
        console.error(`[Middleware] Auth error: ${error instanceof Error ? error.message : "Unknown error"}`);
        return res.status(401).json({ message: "Unauthorized" });
    }
};
exports.requireUser = requireUser;
