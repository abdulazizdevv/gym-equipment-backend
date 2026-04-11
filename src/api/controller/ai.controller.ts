import { NextFunction, Request, Response } from "express"
import { v4 } from "uuid"
import path from "path"
import fs from "fs"
import { QueryTypes } from "sequelize"
import AiSession from "../../models/AiSession"
import AiPost from "../../models/AiPost"
import {
  detectEquipment,
  generateExerciseIllustrationWithOpenAI,
} from "../../services/ai/detectEquipment"
import { sequelize } from "../../database/connection"
import { uploadFile, deleteFile } from "../../services/storage/r2.service"
import { optimizeImage } from "../../services/storage/image.service"

interface AuthRequest extends Request {
  userId?: number
}

/** GET /ai/sessions/:id javobi (data = asosiy search post) */
export type AiSessionDetailPost = {
  id: number
  type: string
  imageUrl: string | null
  request: Record<string, unknown>
  result: Record<string, unknown>
  createdAt: Date
}

export type AiSessionDetailResponse = {
  id: number
  createdAt: Date
  data: AiSessionDetailPost | null
  followups?: AiSessionDetailPost[]
}

type SessionsQuery = {
  page: number
  limit: number
  q: string | null
  sortBy: "createdAt" | "lastActivityAt" | "title"
  order: "asc" | "desc"
}

const serializeAiPost = (p: AiPost): AiSessionDetailPost => ({
  id: p.id,
  type: p.type,
  imageUrl: p.imagePath
    ? p.imagePath.startsWith("http")
      ? p.imagePath
      : `/uploads/${p.imagePath}`
    : null,
  request: p.requestJson as Record<string, unknown>,
  result: p.resultJson as Record<string, unknown>,
  createdAt: p.createdAt,
})

const parseSessionsQuery = (req: Request): SessionsQuery => {
  const rawPage = Number(req.query.page)
  const rawLimit = Number(req.query.limit)

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 50)
      : 10

  const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const q = qRaw.length > 0 ? qRaw.toLowerCase() : null

  const sortByRaw =
    typeof req.query.sortBy === "string" ? req.query.sortBy.trim() : ""
  const sortBy: SessionsQuery["sortBy"] =
    sortByRaw === "createdAt" ||
    sortByRaw === "title" ||
    sortByRaw === "lastActivityAt"
      ? sortByRaw
      : "lastActivityAt"

  const orderRaw =
    typeof req.query.order === "string"
      ? req.query.order.trim().toLowerCase()
      : ""
  const order: SessionsQuery["order"] = orderRaw === "asc" ? "asc" : "desc"

  return { page, limit, q, sortBy, order }
}

const getRequestLanguage = (req: Request): string => {
  const lang = req.headers.lang
  if (typeof lang === "string" && lang.trim()) return lang.trim()

  const xLang = req.headers["x-lang"]
  if (typeof xLang === "string" && xLang.trim()) return xLang.trim()

  const acceptLanguage = req.headers["accept-language"]
  if (typeof acceptLanguage === "string" && acceptLanguage.trim()) {
    const first = acceptLanguage.split(",")[0]?.trim()
    if (first) return first
  }

  return "uz"
}

const getUploadedImage = (
  req: Request,
): { file: any; ext: string; imageName: string } | null => {
  const files = (req as any).files as undefined | Record<string, any>
  const image = files?.image
  if (!image) return null

  const file = Array.isArray(image) ? image[0] : image
  const ext = (file.mimetype?.split("/")?.[1] ?? "jpg").toLowerCase()
  const imageName = `${v4()}.${ext}`

  return { file, ext, imageName }
}

const extToMime = (ext: string): string => {
  const e = ext.toLowerCase()
  if (e === "png") return "image/png"
  if (e === "webp") return "image/webp"
  if (e === "gif") return "image/gif"
  return "image/jpeg"
}

export const postAiEquipment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ message: "Unauthorized" })
    const language = getRequestLanguage(req)

    const { sessionId, question } = req.body ?? {}

    // SEARCH mode: client uploads `image`
    const uploaded = getUploadedImage(req)
    if (uploaded) {
      // 0. Optimize: Compress and convert to WebP
      const optimized = await optimizeImage(uploaded.file.data)
      const webpName = `${v4()}.webp`

      // 1. Upload to Cloudflare R2
      const r2Url = await uploadFile(
        optimized.buffer,
        webpName,
        optimized.mimeType,
      )

      // 2. Detect equipment with Gemini
      const result = await detectEquipment({
        image: {
          filePath: "", // Not used when buffer is provided
          buffer: optimized.buffer,
          url: r2Url,
          mimeType: optimized.mimeType,
        },
        question: typeof question === "string" ? question : undefined,
        history: [],
        language,
      })

      // 3. Create session and post in DB
      const { session, post } = await sequelize.transaction(
        async (transaction) => {
          const session = await AiSession.create({ userId }, { transaction })
          const post = await AiPost.create(
            {
              sessionId: session.id,
              type: "search",
              imagePath: r2Url, // Store FULL Cloudflare URL in DB
              requestJson: {
                question: typeof question === "string" ? question : null,
              },
              resultJson: result as Record<string, unknown>,
            },
            { transaction },
          )
          return { session, post }
        },
      )

      // 4. Return response with R2 URL
      return res.status(200).json({
        type: "search",
        sessionId: session.id,
        imageUrl: r2Url,
        postId: post.id,
        data: result,
      })
    }

    // FOLLOWUP mode: client sends `question` and `sessionId`
    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required." })
    }

    const parsedSessionId =
      typeof sessionId === "number" ? sessionId : Number(sessionId)
    if (Number.isNaN(parsedSessionId)) {
      return res.status(400).json({ message: "sessionId must be a number." })
    }

    const session = await AiSession.findOne({
      where: { id: parsedSessionId, userId },
    })
    if (!session) return res.status(403).json({ message: "Access denied." })

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return res.status(400).json({ message: "question is required." })
    }

    const posts = await AiPost.findAll({
      where: { sessionId: parsedSessionId },
      order: [["createdAt", "ASC"]],
    })

    const history = posts.map((p) => ({
      type: p.type,
      request: p.requestJson,
      result: p.resultJson,
    }))

    // New AI call for each follow-up turn
    const result = await detectEquipment({
      question,
      history,
      language,
    })

    const post = await sequelize.transaction(async (transaction) =>
      AiPost.create(
        {
          sessionId: session.id,
          type: "followup",
          imagePath: null,
          requestJson: { question },
          resultJson: result as Record<string, unknown>,
        },
        { transaction },
      ),
    )

    return res.status(200).json({
      type: "followup",
      sessionId: session.id,
      postId: post.id,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export const getAiSessions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ message: "Unauthorized" })

    const query = parseSessionsQuery(req)
    const offset = (query.page - 1) * query.limit
    const sortColumn =
      query.sortBy === "title"
        ? "title"
        : query.sortBy === "createdAt"
          ? "created_at"
          : "last_activity_at"
    const sortDirection = query.order === "asc" ? "ASC" : "DESC"

    const rows = await sequelize.query<{
      id: number
      title: string
      primary_muscle: string | null
      image_path: string | null
      created_at: string
      last_activity_at: string
      post_count: number
      total_count: number
    }>(
      `
      WITH session_stats AS (
        SELECT
          s.id,
          s.created_at,
          COALESCE((
            SELECT p.result_json->'equipment'->>'name'
            FROM ai_posts p
            WHERE p.session_id = s.id
            ORDER BY p.created_at ASC
            LIMIT 1
          ), 'Unknown equipment') AS title,
          (
            SELECT p.result_json->'muscles'->>0
            FROM ai_posts p
            WHERE p.session_id = s.id
            ORDER BY p.created_at ASC
            LIMIT 1
          ) AS primary_muscle,
          (
            SELECT p.image_path
            FROM ai_posts p
            WHERE p.session_id = s.id AND p.type = 'search'
            ORDER BY p.created_at ASC
            LIMIT 1
          ) AS image_path,
          COALESCE((
            SELECT MAX(p.created_at)
            FROM ai_posts p
            WHERE p.session_id = s.id
          ), s.created_at) AS last_activity_at,
          (
            SELECT COUNT(*)::int
            FROM ai_posts p
            WHERE p.session_id = s.id
          ) AS post_count
        FROM ai_sessions s
        WHERE s.user_id = :userId
      )
      SELECT
        ss.*,
        COUNT(*) OVER()::int AS total_count
      FROM session_stats ss
      WHERE (
        :q IS NULL
        OR ss.title ILIKE :qLike
        OR COALESCE(ss.primary_muscle, '') ILIKE :qLike
      )
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT :limit OFFSET :offset
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          userId,
          q: query.q,
          qLike: query.q ? `%${query.q}%` : null,
          limit: query.limit,
          offset,
        },
      },
    )

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit)
    const paginated = rows.map((row) => ({
      id: row.id,
      title: row.title,
      primaryMuscle: row.primary_muscle,
      imageUrl: row.image_path
        ? row.image_path.startsWith("http")
          ? row.image_path
          : `/uploads/${row.image_path}`
        : null,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
      postCount: Number(row.post_count),
    }))

    return res.status(200).json({
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        q: query.q,
        sortBy: query.sortBy,
        order: query.order,
      },
      items: paginated,
    })
  } catch (error) {
    return next(error)
  }
}
export const getAiSessionById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ message: "Unauthorized" })

    const sessionId = Number(req.params.id)
    if (Number.isNaN(sessionId)) {
      return res.status(400).json({ message: "Invalid id" })
    }

    const session = await AiSession.findOne({
      where: { id: sessionId, userId },
      include: [
        {
          model: AiPost,
          as: "posts",
          separate: true,
          order: [["createdAt", "ASC"]],
        },
      ],
    })

    if (!session) return res.status(404).json({ message: "Not found" })

    const posts = session.posts ?? []

    let primary: AiPost | undefined
    for (let i = 0; i < posts.length; i++) {
      if (posts[i].type === "search") {
        primary = posts[i]
        break
      }
    }
    if (posts.length > 0 && primary === undefined) {
      primary = posts[0]
    }

    const followups: AiSessionDetailPost[] = []
    if (primary !== undefined) {
      for (let i = 0; i < posts.length; i++) {
        if (posts[i].id !== primary.id) {
          followups.push(serializeAiPost(posts[i]))
        }
      }
    }

    const body: AiSessionDetailResponse = {
      id: session.id,
      createdAt: session.createdAt,
      data: primary !== undefined ? serializeAiPost(primary) : null,
    }
    if (followups.length > 0) {
      body.followups = followups
    }

    return res.status(200).json(body)
  } catch (error) {
    return next(error)
  }
}

export const deleteAiSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ message: "Unauthorized" })

    const sessionId = Number(req.params.id)
    if (Number.isNaN(sessionId)) {
      return res.status(400).json({ message: "Invalid id" })
    }

    const session = await AiSession.findOne({
      where: { id: sessionId, userId },
    })
    if (!session) return res.status(404).json({ message: "Not found" })

    const posts = await AiPost.findAll({ where: { sessionId } })
    for (const p of posts) {
      const imagePath = p.imagePath
      if (imagePath) {
        if (imagePath.startsWith("http")) {
          // Delete from R2 (extract filename from URL)
          const fileName = imagePath.split("/").pop()
          if (fileName) await deleteFile(fileName)
        } else {
          // Legacy local deletion
          const filePath = path.join(process.cwd(), "uploads", imagePath)
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath)
            } catch {}
          }
        }
      }
    }

    await AiPost.destroy({ where: { sessionId } })
    await AiSession.destroy({ where: { id: sessionId } })

    return res.status(200).json({ message: "Deleted" })
  } catch (error) {
    return next(error)
  }
}

export const generateAiImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ message: "Unauthorized" })

    const sessionId = Number(req.params.sessionId)
    const postId = Number(req.params.postId)
    if (Number.isNaN(sessionId) || Number.isNaN(postId)) {
      return res.status(400).json({ message: "Invalid sessionId or postId" })
    }

    const session = await AiSession.findOne({
      where: { id: sessionId, userId },
    })
    if (!session) return res.status(404).json({ message: "Session not found" })

    const post = await AiPost.findOne({
      where: { id: postId, sessionId },
    })
    if (!post) return res.status(404).json({ message: "Post not found" })

    const resultJson: any = post.resultJson || {}

    // Safety check: Don't generate illustrations if the original image wasn't gym equipment
    if (resultJson.isGymEquipment === false) {
      return res.status(400).json({
        message:
          "This content is not recognized as gym equipment. Illustration generation is only available for fitness-related machinery.",
      })
    }

    const equipmentName = resultJson?.equipment?.name || "Unknown equipment"
    const muscles = Array.isArray(resultJson?.muscles) ? resultJson.muscles : []

    const language = getRequestLanguage(req)

    const generatedImages = await generateExerciseIllustrationWithOpenAI({
      equipmentName,
      muscles,
      language,
    })

    if (!Array.isArray(resultJson.images)) {
      resultJson.images = []
    }

    const newImages = generatedImages.map((url: string) => ({
      url,
      caption: "Generated Illustration",
    }))

    resultJson.images.push(...newImages)

    // Overwrite the field completely to track changes and save
    post.setDataValue("resultJson", resultJson)
    post.changed("resultJson", true)
    await post.save()

    return res.status(200).json({
      message: "Images generated successfully",
      images: newImages,
      post: serializeAiPost(post),
    })
  } catch (error) {
    return next(error)
  }
}
