"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlerError = void 0;
const handlerError = async (error, req, res, next) => {
    res.status(error.code || 500).json({ message: error.message });
};
exports.handlerError = handlerError;
