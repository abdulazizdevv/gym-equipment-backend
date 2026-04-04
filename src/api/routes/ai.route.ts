import { Router } from "express"
import { requireUser } from "../../middleware/requireUser.middleware"
import {
  deleteAiSession,
  getAiSessionById,
  getAiSessions,
  postAiEquipment,
  generateAiImage,
} from "../controller/ai.controller"

export const router = Router()

// Single endpoint:
// - multipart/form-data with `image` => "search"
// - JSON body with `sessionId` + `question` => "followup"
router.post("/ai/equipment", requireUser, postAiEquipment)

// History CRUD
router.get("/ai/sessions", requireUser, getAiSessions)
router.get("/ai/sessions/:id", requireUser, getAiSessionById)
router.delete("/ai/sessions/:id", requireUser, deleteAiSession)

// Generate image for a specific post (Paid/Manual Trigger)
router.post(
  "/ai/sessions/:sessionId/posts/:postId/generate-image",
  requireUser,
  generateAiImage,
)
