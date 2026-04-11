import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../api/utils/jwt";
import User from "../models/User";

interface RequireUserRequest extends Request {
  userId?: number;
}

export const requireUser = async (
  req: RequireUserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      console.warn("[Middleware] No token provided");
      return res.status(401).json({ message: "Unauthorized: No token" });
    }

    const decoded = verifyToken(token) as unknown as { id?: number };
    if (!decoded?.id) {
      console.warn("[Middleware] Invalid token payload");
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Success: Pass to controller
    console.log(`[Middleware] Auth success for User ID: ${decoded.id}`);
    req.userId = decoded.id;
    return next();
  } catch (error) {
    console.error(`[Middleware] Auth error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

