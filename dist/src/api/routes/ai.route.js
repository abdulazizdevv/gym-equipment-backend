"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const requireUser_middleware_1 = require("../../middleware/requireUser.middleware");
const ai_controller_1 = require("../controller/ai.controller");
exports.router = (0, express_1.Router)();
// Single endpoint:
// - multipart/form-data with `image` => "search"
// - JSON body with `sessionId` + `question` => "followup"
exports.router.post("/ai/equipment", requireUser_middleware_1.requireUser, ai_controller_1.postAiEquipment);
// History CRUD
exports.router.get("/ai/sessions", requireUser_middleware_1.requireUser, ai_controller_1.getAiSessions);
exports.router.get("/ai/sessions/:id", requireUser_middleware_1.requireUser, ai_controller_1.getAiSessionById);
exports.router.delete("/ai/sessions/:id", requireUser_middleware_1.requireUser, ai_controller_1.deleteAiSession);
// Generate image for a specific post (Paid/Manual Trigger)
exports.router.post("/ai/sessions/:sessionId/posts/:postId/generate-image", requireUser_middleware_1.requireUser, ai_controller_1.generateAiImage);
