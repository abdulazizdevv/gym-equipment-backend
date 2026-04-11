"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.signToken = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const config_1 = __importDefault(require("config"));
const secret_key = config_1.default.get('SECRET_KEY');
const signToken = (payload) => (0, jsonwebtoken_1.sign)(payload, secret_key, { expiresIn: '24h' });
exports.signToken = signToken;
const verifyToken = (payload) => (0, jsonwebtoken_1.verify)(payload, secret_key);
exports.verifyToken = verifyToken;
