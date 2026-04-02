"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassword = exports.hashPassword = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const getSaltRounds = () => {
    const raw = process.env.BCRYPT_SALT_ROUNDS;
    const parsed = raw ? Number(raw) : 10;
    if (Number.isNaN(parsed) || parsed < 6 || parsed > 15)
        return 10;
    return parsed;
};
const hashPassword = async (password) => {
    const rounds = getSaltRounds();
    return await bcryptjs_1.default.hash(password, rounds);
};
exports.hashPassword = hashPassword;
const verifyPassword = async (password, passwordHash) => {
    return await bcryptjs_1.default.compare(password, passwordHash);
};
exports.verifyPassword = verifyPassword;
