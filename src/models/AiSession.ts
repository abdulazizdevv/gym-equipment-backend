import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database/connection";

class AiSession extends Model {
  public id!: number;
  public userId!: number;
  public createdAt!: Date;
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
      field: "user_id",
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    sequelize,
    tableName: "ai_sessions",
    timestamps: false,
  }
);

export default AiSession;

