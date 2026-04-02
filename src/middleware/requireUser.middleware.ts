import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../api/utils/jwt";

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
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = verifyToken(token) as unknown as { id?: number };
    if (!decoded?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.userId = decoded.id;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

