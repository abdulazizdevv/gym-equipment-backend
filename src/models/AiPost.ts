import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database/connection";

type AiPostType = "search" | "followup";

class AiPost extends Model {
  public id!: number;
  public sessionId!: number;
  public type!: AiPostType;
  public imagePath!: string | null;
  public requestJson!: Record<string, any>;
  public resultJson!: Record<string, any>;
  public createdAt!: Date;
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
      field: "session_id",
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    imagePath: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "image_path",
    },
    requestJson: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: "request_json",
    },
    resultJson: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: "result_json",
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    sequelize,
    tableName: "ai_posts",
    timestamps: false,
  },
);

export default AiPost;

