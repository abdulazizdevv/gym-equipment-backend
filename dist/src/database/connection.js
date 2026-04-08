"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://abdulaziz@localhost:5432/muskul";
exports.sequelize = new sequelize_1.Sequelize(databaseUrl);
