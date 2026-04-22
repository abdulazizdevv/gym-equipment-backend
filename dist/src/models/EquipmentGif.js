"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const connection_1 = require("../database/connection");
class EquipmentGif extends sequelize_1.Model {
}
EquipmentGif.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    equipmentKey: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: 'equipment_key',
    },
    rawName: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: false,
        field: 'raw_name',
    },
    targetMuscles: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        field: 'target_muscles',
    },
    alternativeNames: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        field: 'alternative_names',
    },
    gifs: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
    source: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'exercisedb',
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'created_at',
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'updated_at',
    },
}, {
    sequelize: connection_1.sequelize,
    tableName: 'equipment_gifs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
exports.default = EquipmentGif;
