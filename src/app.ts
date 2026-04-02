import "dotenv/config";
import express from "express";

const app = express();

import { modules } from "./start/modules";
import { run } from "./start/run";

modules(app);
run(app);
