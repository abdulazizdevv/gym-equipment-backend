import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export type GifSource = 'exercisedb' | 'manual';

export interface GifItem {
  url: string;
  caption: string;
  exerciseName?: string;
}

export interface EquipmentGifAttributes {
  id: number;
  equipmentKey: string;
  rawName: string;
  targetMuscles: string[];
  alternativeNames: string[];
  gifs: GifItem[];
  source: GifSource;
  createdAt: Date;
  updatedAt: Date;
}

export type EquipmentGifCreationAttributes = Optional<
  EquipmentGifAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'source' | 'targetMuscles' | 'alternativeNames'
>;

class EquipmentGif extends Model<EquipmentGifAttributes, EquipmentGifCreationAttributes> {
  declare id: number;
  declare equipmentKey: string;
  declare rawName: string;
  declare targetMuscles: string[];
  declare alternativeNames: string[];
  declare gifs: GifItem[];
  declare source: GifSource;
  declare createdAt: Date;
  declare updatedAt: Date;
}

EquipmentGif.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    equipmentKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'equipment_key',
    },
    rawName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'raw_name',
    },
    targetMuscles: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'target_muscles',
    },
    alternativeNames: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'alternative_names',
    },
    gifs: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'exercisedb',
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'equipment_gifs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default EquipmentGif;
