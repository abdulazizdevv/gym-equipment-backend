import { Sequelize, Options } from "sequelize"

const databaseUrl: string =
  process.env.DATABASE_URL ?? "postgresql://abdulaziz@localhost:5432/muskul"

const options: Options = {
  dialect: "postgres",
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
}

// Neon and other managed PG hosts require SSL
if (databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=require")) {
  options.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Required for many managed DB providers
    },
    keepAlive: true,
  }
}

export const sequelize = new Sequelize(databaseUrl, options)
