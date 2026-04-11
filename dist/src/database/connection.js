"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://abdulaziz@localhost:5432/muskul";
const options = {
    dialect: "postgres",
};
// Neon and other managed PG hosts require SSL
if (databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=require")) {
    options.dialectOptions = {
        ssl: {
            require: true,
            rejectUnauthorized: false, // Required for many managed DB providers
        },
    };
}
exports.sequelize = new sequelize_1.Sequelize(databaseUrl, options);
