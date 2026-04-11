"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const connection_1 = require("../database/connection");
class User extends sequelize_1.Model {
    id;
    googleId;
    name;
    email;
    emailCanonical;
    passwordHash;
    avatarUrl;
    createdAt;
}
User.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    googleId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: "google_id",
    },
    name: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    emailCanonical: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: "email_canonical",
    },
    passwordHash: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        field: "password_hash",
    },
    avatarUrl: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: "created_at",
    },
}, {
    sequelize: connection_1.sequelize,
    tableName: "users",
    timestamps: false,
});
exports.default = User;
