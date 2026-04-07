import { NextFunction, Request, Response } from "express";
import { decode } from "jsonwebtoken";
import User from "../../models/User";
import { signToken } from "../utils/jwt";
import { canonicalizeEmail } from "../../services/auth/email";

export const authGoogle = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body ?? {};
    const {
      idToken,
      googleId: bodyGoogleId,
      providerAccountId,
      email: bodyEmail,
      name: bodyName,
      avatarUrl: bodyAvatarUrl,
      user: bodyUser,
    } = body;

    let googleId: string | undefined = bodyGoogleId || providerAccountId;
    let email: string | null | undefined = bodyEmail || bodyUser?.email;
    let name: string | undefined = bodyName || bodyUser?.name;
    let avatarUrl: string | null | undefined = bodyAvatarUrl || bodyUser?.image;

    // If front sends `idToken`, decode it (verification later can be added).
    if (idToken && !googleId) {
      const decoded = decode(idToken) as
        | { sub?: string; email?: string; name?: string; picture?: string; given_name?: string }
        | null;

      googleId = decoded?.sub;
      email = decoded?.email;
      name = name ?? decoded?.name ?? decoded?.given_name;
      avatarUrl = avatarUrl ?? decoded?.picture ?? null;
    }

    if (!googleId) {
      return res.status(400).json({ message: "googleId or idToken is required." });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      name = "User";
    }

    const emailInfo =
      typeof email === "string" && email.trim().length > 0
        ? canonicalizeEmail(email)
        : null;

    // If user already registered with email/password, link googleId to that user.
    if (emailInfo?.raw) {
      const byEmail = await User.findOne({
        where: { emailCanonical: emailInfo.canonical },
      });
      if (byEmail) {
        if (!byEmail.dataValues.googleId) {
          await User.update(
            { googleId, avatarUrl: avatarUrl ?? byEmail.dataValues.avatarUrl },
            { where: { id: byEmail.dataValues.id } },
          );
        }

        const token = signToken({ id: byEmail.dataValues.id });
        return res.status(200).json({
          message: "Success",
          token,
          user: {
            id: byEmail.dataValues.id,
            name: byEmail.dataValues.name,
            email: byEmail.dataValues.email,
            avatarUrl: avatarUrl ?? byEmail.dataValues.avatarUrl,
          },
        });
      }
    }

    const [user] = await User.findOrCreate({
      where: { googleId },
      defaults: {
        name,
        email: emailInfo?.raw ? emailInfo.raw : null,
        emailCanonical: emailInfo?.raw ? emailInfo.canonical : null,
        avatarUrl: avatarUrl ?? null,
      },
    });

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

