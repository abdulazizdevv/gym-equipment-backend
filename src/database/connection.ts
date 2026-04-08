import { Sequelize } from "sequelize"

const databaseUrl: string =
  process.env.DATABASE_URL ?? "postgresql://abdulaziz@localhost:5432/muskul"

export const sequelize = new Sequelize(databaseUrl)
