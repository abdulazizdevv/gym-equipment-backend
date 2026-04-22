import { Router } from 'express'
import { requireUser } from '../../middleware/requireUser.middleware'
import {
  postAiEquipment,
  getAiSessions,
  getAiSessionById,
  deleteAiSession,
  adminUpsertEquipmentGifs,
} from '../controller/ai.controller'

export const router = Router()

// ─── AI Equipment Analysis ────────────────────────────────────────────────────
// - multipart/form-data with `image`            → search mode
// - JSON body with `sessionId` + `question`     → follow-up mode
router.post('/ai/equipment', requireUser, postAiEquipment)

// ─── Session History CRUD ─────────────────────────────────────────────────────
router.get('/ai/sessions',     requireUser, getAiSessions)
router.get('/ai/sessions/:id', requireUser, getAiSessionById)
router.delete('/ai/sessions/:id', requireUser, deleteAiSession)

// ─── Admin: Manual GIF Seed ───────────────────────────────────────────────────
// Body: { equipmentName: string, gifUrls: string[], captions?: string[] }
router.post('/admin/equipment-gifs', adminUpsertEquipmentGifs)
