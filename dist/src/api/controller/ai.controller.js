"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAiImage = exports.deleteAiSession = exports.getAiSessionById = exports.getAiSessions = exports.postAiEquipment = void 0;
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sequelize_1 = require("sequelize");
const AiSession_1 = __importDefault(require("../../models/AiSession"));
const AiPost_1 = __importDefault(require("../../models/AiPost"));
const detectEquipment_1 = require("../../services/ai/detectEquipment");
const connection_1 = require("../../database/connection");
const serializeAiPost = (p) => ({
    id: p.id,
    type: p.type,
    imageUrl: p.imagePath ? `/uploads/${p.imagePath}` : null,
    request: p.requestJson,
    result: p.resultJson,
    createdAt: p.createdAt,
});
const parseSessionsQuery = (req) => {
    const rawPage = Number(req.query.page);
    const rawLimit = Number(req.query.limit);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 50)
        : 10;
    const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const q = qRaw.length > 0 ? qRaw.toLowerCase() : null;
    const sortByRaw = typeof req.query.sortBy === "string" ? req.query.sortBy.trim() : "";
    const sortBy = sortByRaw === "createdAt" ||
        sortByRaw === "title" ||
        sortByRaw === "lastActivityAt"
        ? sortByRaw
        : "lastActivityAt";
    const orderRaw = typeof req.query.order === "string"
        ? req.query.order.trim().toLowerCase()
        : "";
    const order = orderRaw === "asc" ? "asc" : "desc";
    return { page, limit, q, sortBy, order };
};
const getRequestLanguage = (req) => {
    const lang = req.headers.lang;
    if (typeof lang === "string" && lang.trim())
        return lang.trim();
    const xLang = req.headers["x-lang"];
    if (typeof xLang === "string" && xLang.trim())
        return xLang.trim();
    const acceptLanguage = req.headers["accept-language"];
    if (typeof acceptLanguage === "string" && acceptLanguage.trim()) {
        const first = acceptLanguage.split(",")[0]?.trim();
        if (first)
            return first;
    }
    return "uz";
};
const getUploadedImage = (req) => {
    const files = req.files;
    const image = files?.image;
    if (!image)
        return null;
    const file = Array.isArray(image) ? image[0] : image;
    const ext = (file.mimetype?.split("/")?.[1] ?? "jpg").toLowerCase();
    const imageName = `${(0, uuid_1.v4)()}.${ext}`;
    return { file, ext, imageName };
};
const extToMime = (ext) => {
    const e = ext.toLowerCase();
    if (e === "png")
        return "image/png";
    if (e === "webp")
        return "image/webp";
    if (e === "gif")
        return "image/gif";
    return "image/jpeg";
};
const postAiEquipment = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const language = getRequestLanguage(req);
        const { sessionId, question } = req.body ?? {};
        // SEARCH mode: client uploads `image`
        const uploaded = getUploadedImage(req);
        if (uploaded) {
            const uploadsDir = path_1.default.join(process.cwd(), "uploads");
            if (!fs_1.default.existsSync(uploadsDir))
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            const imagePathFs = path_1.default.join(uploadsDir, uploaded.imageName);
            await new Promise((resolve, reject) => {
                uploaded.file.mv(imagePathFs, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            const stat = fs_1.default.statSync(imagePathFs);
            if (stat.size === 0) {
                try {
                    fs_1.default.unlinkSync(imagePathFs);
                }
                catch { }
                return res.status(400).json({
                    message: 'Empty image upload. Send the file bytes in multipart field "image" (e.g. curl -F image=@photo.jpg).',
                });
            }
            const result = await (0, detectEquipment_1.detectEquipment)({
                image: {
                    filePath: imagePathFs,
                    url: `/uploads/${uploaded.imageName}`,
                    mimeType: extToMime(uploaded.ext),
                },
                question: typeof question === "string" ? question : undefined,
                history: [],
                language,
            });
            const { session, post } = await connection_1.sequelize.transaction(async (transaction) => {
                const session = await AiSession_1.default.create({ userId }, { transaction });
                const post = await AiPost_1.default.create({
                    sessionId: session.id,
                    type: "search",
                    imagePath: uploaded.imageName,
                    requestJson: {
                        question: typeof question === "string" ? question : null,
                    },
                    resultJson: result,
                }, { transaction });
                return { session, post };
            });
            return res.status(200).json({
                type: "search",
                sessionId: session.id,
                imageUrl: `/uploads/${uploaded.imageName}`,
                postId: post.id,
                data: result,
            });
        }
        // FOLLOWUP mode: client sends `question` and `sessionId`
        if (!sessionId) {
            return res.status(400).json({ message: "sessionId is required." });
        }
        const parsedSessionId = typeof sessionId === "number" ? sessionId : Number(sessionId);
        if (Number.isNaN(parsedSessionId)) {
            return res.status(400).json({ message: "sessionId must be a number." });
        }
        const session = await AiSession_1.default.findOne({
            where: { id: parsedSessionId, userId },
        });
        if (!session)
            return res.status(403).json({ message: "Access denied." });
        if (!question ||
            typeof question !== "string" ||
            question.trim().length === 0) {
            return res.status(400).json({ message: "question is required." });
        }
        const posts = await AiPost_1.default.findAll({
            where: { sessionId: parsedSessionId },
            order: [["createdAt", "ASC"]],
        });
        const history = posts.map((p) => ({
            type: p.type,
            request: p.requestJson,
            result: p.resultJson,
        }));
        // New AI call for each follow-up turn.
        const result = await (0, detectEquipment_1.detectEquipment)({
            question,
            history,
            language,
        });
        const post = await connection_1.sequelize.transaction(async (transaction) => AiPost_1.default.create({
            sessionId: session.id,
            type: "followup",
            imagePath: null,
            requestJson: { question },
            resultJson: result,
        }, { transaction }));
        return res.status(200).json({
            type: "followup",
            sessionId: session.id,
            postId: post.id,
            data: result,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.postAiEquipment = postAiEquipment;
const getAiSessions = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const query = parseSessionsQuery(req);
        const offset = (query.page - 1) * query.limit;
        const sortColumn = query.sortBy === "title"
            ? "title"
            : query.sortBy === "createdAt"
                ? "created_at"
                : "last_activity_at";
        const sortDirection = query.order === "asc" ? "ASC" : "DESC";
        const rows = await connection_1.sequelize.query(`
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
      `, {
            type: sequelize_1.QueryTypes.SELECT,
            replacements: {
                userId,
                q: query.q,
                qLike: query.q ? `%${query.q}%` : null,
                limit: query.limit,
                offset,
            },
        });
        const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
        const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
        const paginated = rows.map((row) => ({
            id: row.id,
            title: row.title,
            primaryMuscle: row.primary_muscle,
            imageUrl: row.image_path ? `/uploads/${row.image_path}` : null,
            createdAt: row.created_at,
            lastActivityAt: row.last_activity_at,
            postCount: Number(row.post_count),
        }));
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
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAiSessions = getAiSessions;
const getAiSessionById = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const sessionId = Number(req.params.id);
        if (Number.isNaN(sessionId)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        const session = await AiSession_1.default.findOne({
            where: { id: sessionId, userId },
            include: [
                {
                    model: AiPost_1.default,
                    as: "posts",
                    separate: true,
                    order: [["createdAt", "ASC"]],
                },
            ],
        });
        if (!session)
            return res.status(404).json({ message: "Not found" });
        const posts = session.posts ?? [];
        let primary;
        for (let i = 0; i < posts.length; i++) {
            if (posts[i].type === "search") {
                primary = posts[i];
                break;
            }
        }
        if (posts.length > 0 && primary === undefined) {
            primary = posts[0];
        }
        const followups = [];
        if (primary !== undefined) {
            for (let i = 0; i < posts.length; i++) {
                if (posts[i].id !== primary.id) {
                    followups.push(serializeAiPost(posts[i]));
                }
            }
        }
        const body = {
            id: session.id,
            createdAt: session.createdAt,
            data: primary !== undefined ? serializeAiPost(primary) : null,
        };
        if (followups.length > 0) {
            body.followups = followups;
        }
        return res.status(200).json(body);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAiSessionById = getAiSessionById;
const deleteAiSession = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const sessionId = Number(req.params.id);
        if (Number.isNaN(sessionId)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        const session = await AiSession_1.default.findOne({
            where: { id: sessionId, userId },
        });
        if (!session)
            return res.status(404).json({ message: "Not found" });
        const posts = await AiPost_1.default.findAll({ where: { sessionId } });
        for (const p of posts) {
            const imagePath = p.imagePath;
            if (imagePath) {
                const filePath = path_1.default.join(process.cwd(), "uploads", imagePath);
                if (fs_1.default.existsSync(filePath)) {
                    try {
                        fs_1.default.unlinkSync(filePath);
                    }
                    catch { }
                }
            }
        }
        await AiPost_1.default.destroy({ where: { sessionId } });
        await AiSession_1.default.destroy({ where: { id: sessionId } });
        return res.status(200).json({ message: "Deleted" });
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteAiSession = deleteAiSession;
const generateAiImage = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const sessionId = Number(req.params.sessionId);
        const postId = Number(req.params.postId);
        if (Number.isNaN(sessionId) || Number.isNaN(postId)) {
            return res.status(400).json({ message: "Invalid sessionId or postId" });
        }
        const session = await AiSession_1.default.findOne({
            where: { id: sessionId, userId },
        });
        if (!session)
            return res.status(404).json({ message: "Session not found" });
        const post = await AiPost_1.default.findOne({
            where: { id: postId, sessionId },
        });
        if (!post)
            return res.status(404).json({ message: "Post not found" });
        const resultJson = post.resultJson || {};
        const equipmentName = resultJson?.equipment?.name || "Unknown equipment";
        const muscles = Array.isArray(resultJson?.muscles) ? resultJson.muscles : [];
        const language = getRequestLanguage(req);
        const generatedImages = await (0, detectEquipment_1.generateExerciseIllustrationWithOpenAI)({
            equipmentName,
            muscles,
            language,
        });
        if (!Array.isArray(resultJson.images)) {
            resultJson.images = [];
        }
        const newImages = generatedImages.map((url) => ({
            url,
            caption: "Generated Illustration",
        }));
        resultJson.images.push(...newImages);
        // Overwrite the field completely to track changes and save
        post.setDataValue("resultJson", resultJson);
        post.changed("resultJson", true);
        await post.save();
        return res.status(200).json({
            message: "Images generated successfully",
            images: newImages,
            post: serializeAiPost(post),
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.generateAiImage = generateAiImage;
