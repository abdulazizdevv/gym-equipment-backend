import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';
import type AiPost from './AiPost';

export interface AiSessionAttributes {
  id: number;
  userId: number;
  createdAt: Date;
}

export type AiSessionCreationAttributes = Optional<
  AiSessionAttributes,
  'id' | 'createdAt'
>;

class AiSession extends Model<
  AiSessionAttributes,
  AiSessionCreationAttributes
> {
  declare id: number;
  declare userId: number;
  declare createdAt: Date;

  /** hasMany(AiPost, { as: 'posts' }) — include bilan keladi */
  declare posts?: AiPost[];
}

AiSession.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'ai_sessions',
    timestamps: false,
  },
);

export default AiSession;
