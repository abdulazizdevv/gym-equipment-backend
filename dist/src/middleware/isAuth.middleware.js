"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuth = void 0;
const jwt_1 = require("../api/utils/jwt");
const isAuth = (req, res, next) => {
    try {
        const token = req.headers.authorization && req.headers.authorization.split(" ")[1];
        if (!token)
            return res.status(401).json({ message: "Invalid Token" });
        const { id } = (0, jwt_1.verifyToken)(token);
        req.verifyUser = id;
        next();
    }
    catch (error) {
        res.status(401).json({ message: error.message });
    }
};
exports.isAuth = isAuth;
