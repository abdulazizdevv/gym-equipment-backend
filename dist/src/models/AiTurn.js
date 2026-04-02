"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const connection_1 = require("../database/connection");
class AiTurn extends sequelize_1.Model {
    id;
    sessionId;
    type;
    imagePath;
    requestJson;
    resultJson;
    createdAt;
}
AiTurn.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    sessionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        field: "session_id",
    },
    type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    imagePath: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        field: "image_path",
    },
    requestJson: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        field: "request_json",
    },
    resultJson: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        field: "result_json",
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: "created_at",
    },
}, {
    sequelize: connection_1.sequelize,
    tableName: "ai_turns",
    timestamps: false,
});
exports.default = AiTurn;
