import { NextFunction, Request, Response } from "express";
import User from "../../models/User";
import { signToken } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../../services/auth/password";
import { canonicalizeEmail } from "../../services/auth/email";

export const registerLocal = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, email, password } = req.body ?? {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ message: "name is required." });
    }
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "email is required." });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 chars." });
    }

    const emailInfo = canonicalizeEmail(email);
    if (!emailInfo.raw) return res.status(400).json({ message: "email is required." });

    const existing = await User.findOne({
      where: { emailCanonical: emailInfo.canonical },
    });
    if (existing) {
      return res.status(409).json({ message: "User already exists." });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: emailInfo.raw,
      emailCanonical: emailInfo.canonical,
      passwordHash,
      googleId: null,
      avatarUrl: null,
    });

    const token = signToken({ id: user.dataValues.id });
    return res.status(201).json({
      message: "Success",
      token,
      user: {
        id: user.dataValues.id,
        name: user.dataValues.name,
        email: user.dataValues.email,
        avatarUrl: user.dataValues.avatarUrl,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const loginLocal = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "email is required." });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "password is required." });
    }

    const emailInfo = canonicalizeEmail(email);
    if (!emailInfo.raw) return res.status(400).json({ message: "email is required." });

    const user = await User.findOne({
      where: { emailCanonical: emailInfo.canonical },
    });
    if (!user || !user.dataValues.passwordHash) {
      return res.status(403).json({ message: "Invalid email or password." });
    }

    const ok = await verifyPassword(password, user.dataValues.passwordHash);
    if (!ok) {
      return res.status(403).json({ message: "Invalid email or password." });
    }

    const token = signToken({ id: user.dataValues.id });
    return res.status(200).json({
      message: "Success",
      token,
      user: {
        id: user.dataValues.id,
        name: user.dataValues.name,
        email: user.dataValues.email,
        avatarUrl: user.dataValues.avatarUrl,
      },
    });
  } catch (error) {
    return next(error);
  }
};

