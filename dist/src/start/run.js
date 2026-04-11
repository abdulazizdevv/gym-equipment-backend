"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const Relation_1 = require("../models/Relation");
const connection_1 = require("./../database/connection");
const init_db_1 = require("../database/init-db");
const run = async (app) => {
    await (0, init_db_1.initDb)();
    (0, Relation_1.relations)();
    await connection_1.sequelize.authenticate({
        logging: false,
    });
    await connection_1.sequelize.sync({
        alter: true,
        logging: false,
    });
    console.log("Connected to the database.");
    const portRaw = process.env.PORT;
    const port = portRaw ? Number(portRaw) : undefined;
    const resolvedPort = port && !Number.isNaN(port) ? port : undefined;
    if (!resolvedPort) {
        throw new Error("Missing env PORT. Add PORT to .env (or set process.env.PORT).");
    }
    app.listen(resolvedPort, () => {
        console.log(`Server is listening on port ${resolvedPort}`);
    });
};
exports.run = run;
