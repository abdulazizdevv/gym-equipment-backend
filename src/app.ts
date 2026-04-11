import "dotenv/config";
import express from "express";

const app = express();

app.get("/ping", (req, res) => {
  console.log("PING HIT");
  res.json({ ok: true });
});

import { modules } from "./start/modules";
import { run } from "./start/run";

modules(app);
run(app);
