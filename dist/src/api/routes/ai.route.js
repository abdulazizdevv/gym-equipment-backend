"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const requireUser_middleware_1 = require("../../middleware/requireUser.middleware");
const ai_controller_1 = require("../controller/ai.controller");
exports.router = (0, express_1.Router)();
// ─── AI Equipment Analysis ────────────────────────────────────────────────────
// - multipart/form-data with `image`            → search mode
// - JSON body with `sessionId` + `question`     → follow-up mode
exports.router.post('/ai/equipment', requireUser_middleware_1.requireUser, ai_controller_1.postAiEquipment);
// ─── Session History CRUD ─────────────────────────────────────────────────────
exports.router.get('/ai/sessions', requireUser_middleware_1.requireUser, ai_controller_1.getAiSessions);
exports.router.get('/ai/sessions/:id', requireUser_middleware_1.requireUser, ai_controller_1.getAiSessionById);
exports.router.delete('/ai/sessions/:id', requireUser_middleware_1.requireUser, ai_controller_1.deleteAiSession);
// ─── Admin: Manual GIF Seed ───────────────────────────────────────────────────
// Body: { equipmentName: string, gifUrls: string[], captions?: string[] }
exports.router.post('/admin/equipment-gifs', ai_controller_1.adminUpsertEquipmentGifs);
