import { Router } from "express";
import { requireUser } from "../../middleware/requireUser.middleware";
import { getMe } from "../controller/user.controller";

export const router = Router();

router.get("/user/me", requireUser, getMe);

