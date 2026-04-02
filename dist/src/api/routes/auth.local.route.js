"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const auth_local_controller_1 = require("../controller/auth.local.controller");
exports.router = (0, express_1.Router)();
exports.router.post("/auth/register", auth_local_controller_1.registerLocal);
exports.router.post("/auth/login", auth_local_controller_1.loginLocal);
