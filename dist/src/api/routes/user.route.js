"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const requireUser_middleware_1 = require("../../middleware/requireUser.middleware");
const user_controller_1 = require("../controller/user.controller");
exports.router = (0, express_1.Router)();
exports.router.get("/user/me", requireUser_middleware_1.requireUser, user_controller_1.getMe);
