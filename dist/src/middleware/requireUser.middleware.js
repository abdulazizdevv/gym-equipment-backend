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
            return res.status(401).json({ message: "Unauthorized" });
        }
        const decoded = (0, jwt_1.verifyToken)(token);
        if (!decoded?.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        req.userId = decoded.id;
        return next();
    }
    catch (error) {
        return res.status(401).json({ message: "Unauthorized" });
    }
};
exports.requireUser = requireUser;
