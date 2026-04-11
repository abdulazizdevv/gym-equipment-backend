"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_google_route_1 = require("./auth.google.route");
const auth_local_route_1 = require("./auth.local.route");
const ai_route_1 = require("./ai.route");
const user_route_1 = require("./user.route");
exports.default = [auth_local_route_1.router, auth_google_route_1.router, user_route_1.router, ai_route_1.router];
