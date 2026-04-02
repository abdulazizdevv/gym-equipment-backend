import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database/connection";

class User extends Model {
  public id!: number;
  public googleId!: string | null;
  public name!: string;
  public email!: string | null;
  public emailCanonical!: string | null;
  public passwordHash!: string | null;
  public avatarUrl!: string | null;
  public createdAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: "google_id",
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emailCanonical: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: "email_canonical",
    },
    passwordHash: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "password_hash",
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    sequelize,
    tableName: "users",
    timestamps: false,
  }
);

export default User;

