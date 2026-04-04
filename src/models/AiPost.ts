import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export type AiPostType = 'search' | 'followup';

export interface AiPostAttributes {
  id: number;
  sessionId: number;
  type: AiPostType;
  imagePath: string | null;
  requestJson: Record<string, unknown>;
  resultJson: Record<string, unknown>;
  createdAt: Date;
}

export type AiPostCreationAttributes = Optional<
  AiPostAttributes,
  'id' | 'createdAt' | 'imagePath'
>;

class AiPost extends Model<AiPostAttributes, AiPostCreationAttributes> {
  declare id: number;
  declare sessionId: number;
  declare type: AiPostType;
  declare imagePath: string | null;
  declare requestJson: Record<string, unknown>;
  declare resultJson: Record<string, unknown>;
  declare createdAt: Date;
}

AiPost.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'session_id',
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    imagePath: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'image_path',
    },
    requestJson: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'request_json',
    },
    resultJson: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'result_json',
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'ai_posts',
    timestamps: false,
  },
);

export default AiPost;
