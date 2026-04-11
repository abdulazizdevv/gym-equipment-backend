import express, { Application } from "express"
import fileUpload from "express-fileupload"
import cors from "cors"
import path from "path"
import { handlerError } from "../middleware/handle-error.middleware"
import routes from "../api/routes"
import rateLimit from "express-rate-limit"

export const modules = async (app: Application) => {
  // Set up rate limiter: maximum of 100 requests per 15 minutes
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
  })

  // Apply to all requests
  app.use(limiter)

  app.use(express.json({ limit: "50mb" }))
  app.use(express.urlencoded({ limit: "50mb", extended: true }))
  app.use(
    fileUpload({
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  app.use(
    cors({
      origin: "*",
    }),
  )

  // Serve uploaded images publicly (no token required)
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))

  // `routes` is an array of Router instances.
  app.use(...routes)
  app.use(handlerError)
}
