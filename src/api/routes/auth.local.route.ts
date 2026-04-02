import { Router } from "express";
import { loginLocal, registerLocal } from "../controller/auth.local.controller";

export const router = Router();

router.post("/auth/register", registerLocal);
router.post("/auth/login", loginLocal);

