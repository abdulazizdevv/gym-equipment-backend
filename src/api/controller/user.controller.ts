import { NextFunction, Request, Response } from "express";
import User from "../../models/User";

interface AuthRequest extends Request {
  userId?: number;
}

export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    console.log(`[Controller] Fetching user profile for ID: ${userId}`);
    const start = Date.now();
    const user = await User.findOne({ where: { id: userId } });
    const duration = Date.now() - start;
    console.log(`[Controller] User lookup finished in ${duration}ms`);

    if (!user) {
      console.warn(`[Controller] User not found: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      id: user.dataValues.id,
      name: user.dataValues.name,
      email: user.dataValues.email,
      avatarUrl: user.dataValues.avatarUrl,
      createdAt: user.dataValues.createdAt,
    });
  } catch (error) {
    return next(error);
  }
};

