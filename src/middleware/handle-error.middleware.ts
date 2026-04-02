import { NextFunction, Request, Response } from "express";
import { CustomError } from "../api/utils/error";

export const handlerError = async (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(error.code || 500).json({ message: error.message });
};
