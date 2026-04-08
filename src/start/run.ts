import { relations } from "../models/Relation";
import { sequelize } from "./../database/connection";
import { Application } from "express";
import { initDb } from "../database/init-db";

export const run = async (app: Application) => {
  await initDb();
  relations();
  await sequelize.authenticate({
    logging: false,
  });
  await sequelize.sync({
    alter: true,
    logging: false,
  });

  console.log("Connected to the database.");
  const portRaw = process.env.PORT;
  const port = portRaw ? Number(portRaw) : undefined;
  const resolvedPort = port && !Number.isNaN(port) ? port : undefined;

  if (!resolvedPort) {
    throw new Error(
      "Missing env PORT. Add PORT to .env (or set process.env.PORT).",
    );
  }

  app.listen(resolvedPort, () => {
    console.log(`Server is listening on port ${resolvedPort}`);
  });
};
