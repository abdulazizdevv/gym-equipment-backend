import { Router } from "express";
import { authGoogle } from "../controller/auth.google.controller";

export const router = Router();

router.post("/auth/google", authGoogle);

