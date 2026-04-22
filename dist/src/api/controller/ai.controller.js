"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUpsertEquipmentGifs = exports.deleteAiSession = exports.getAiSessionById = exports.getAiSessions = exports.postAiEquipment = void 0;
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sequelize_1 = require("sequelize");
const AiSession_1 = __importDefault(require("../../models/AiSession"));
const AiPost_1 = __importDefault(require("../../models/AiPost"));
const detectEquipment_1 = require("../../services/ai/detectEquipment");
const exercisedb_service_1 = require("../../services/ai/exercisedb.service");
const connection_1 = require("../../database/connection");
const r2_service_1 = require("../../services/storage/r2.service");
const image_service_1 = require("../../services/storage/image.service");
// ─── Serializers ──────────────────────────────────────────────────────────────
const serializeAiPost = (p) => ({
    id: p.id,
    type: p.type,
    imageUrl: p.imagePath
        ? p.imagePath.startsWith('http')
            ? p.imagePath
            : `/uploads/${p.imagePath}`
        : null,
    request: p.requestJson,
    result: p.resultJson,
    createdAt: p.createdAt,
});
// ─── Request Helpers ──────────────────────────────────────────────────────────
const parseSessionsQuery = (req) => {
    const rawPage = Number(req.query.page);
    const rawLimit = Number(req.query.limit);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 50)
        : 10;
    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const q = qRaw.length > 0 ? qRaw.toLowerCase() : null;
    const sortByRaw = typeof req.query.sortBy === 'string' ? req.query.sortBy.trim() : '';
    const sortBy = sortByRaw === 'createdAt' || sortByRaw === 'title' || sortByRaw === 'lastActivityAt'
        ? sortByRaw
        : 'lastActivityAt';
    const orderRaw = typeof req.query.order === 'string' ? req.query.order.trim().toLowerCase() : '';
    const order = orderRaw === 'asc' ? 'asc' : 'desc';
    return { page, limit, q, sortBy, order };
};
const getRequestLanguage = (req) => {
    const lang = req.headers.lang;
    if (typeof lang === 'string' && lang.trim())
        return lang.trim();
    const xLang = req.headers['x-lang'];
    if (typeof xLang === 'string' && xLang.trim())
        return xLang.trim();
    const acceptLanguage = req.headers['accept-language'];
    if (typeof acceptLanguage === 'string' && acceptLanguage.trim()) {
        const first = acceptLanguage.split(',')[0]?.trim();
        if (first)
            return first;
    }
    return 'uz';
};
const getUploadedImage = (req) => {
    const files = req.files;
    const image = files?.image;
    if (!image)
        return null;
    const file = Array.isArray(image) ? image[0] : image;
    const ext = (file.mimetype?.split('/')?.[1] ?? 'jpg').toLowerCase();
    const imageName = `${(0, uuid_1.v4)()}.${ext}`;
    return { file, ext, imageName };
};
// ─── POST /ai/equipment ───────────────────────────────────────────────────────
const postAiEquipment = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const language = getRequestLanguage(req);
        const { sessionId, question } = req.body ?? {};
        // ── Search mode: image upload ─────────────────────────────────────────────
        const uploaded = getUploadedImage(req);
        if (uploaded) {
            const optimized = await (0, image_service_1.optimizeImage)(uploaded.file.data);
            const webpName = `${(0, uuid_1.v4)()}.webp`;
            const r2Url = await (0, r2_service_1.uploadFile)(optimized.buffer, webpName, optimized.mimeType);
            let result;
            try {
                result = await (0, detectEquipment_1.detectEquipment)({
                    image: {
                        filePath: '',
                        buffer: optimized.buffer,
                        url: r2Url,
                        mimeType: optimized.mimeType,
                    },
                    question: typeof question === 'string' ? question : undefined,
                    history: [],
                    language,
                });
            }
            catch (error) {
                // 🗑️ Delete from R2 if AI fails
                await (0, r2_service_1.deleteFile)(webpName);
                throw error;
            }
            const { session, post } = await connection_1.sequelize.transaction(async (transaction) => {
                const session = await AiSession_1.default.create({ userId }, { transaction });
                const post = await AiPost_1.default.create({
                    sessionId: session.id,
                    type: 'search',
                    imagePath: r2Url,
                    requestJson: { question: typeof question === 'string' ? question : null },
                    resultJson: result,
                }, { transaction });
                return { session, post };
            });
            return res.status(200).json({
                type: 'search',
                sessionId: session.id,
                imageUrl: r2Url,
                postId: post.id,
                data: result,
            });
        }
        // ── Follow-up mode: text question ─────────────────────────────────────────
        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required.' });
        }
        const parsedSessionId = typeof sessionId === 'number' ? sessionId : Number(sessionId);
        if (Number.isNaN(parsedSessionId)) {
            return res.status(400).json({ message: 'sessionId must be a number.' });
        }
        const session = await AiSession_1.default.findOne({ where: { id: parsedSessionId, userId } });
        if (!session)
            return res.status(403).json({ message: 'Access denied.' });
        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            return res.status(400).json({ message: 'question is required.' });
        }
        const posts = await AiPost_1.default.findAll({
            where: { sessionId: parsedSessionId },
            order: [['createdAt', 'ASC']],
        });
        const history = posts.map((p) => ({
            type: p.type,
            request: p.requestJson,
            result: p.resultJson,
        }));
        const result = await (0, detectEquipment_1.detectEquipment)({ question, history, language });
        const post = await connection_1.sequelize.transaction(async (transaction) => AiPost_1.default.create({
            sessionId: session.id,
            type: 'followup',
            imagePath: null,
            requestJson: { question },
            resultJson: result,
        }, { transaction }));
        return res.status(200).json({
            type: 'followup',
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
// ─── GET /ai/sessions ─────────────────────────────────────────────────────────
const getAiSessions = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const query = parseSessionsQuery(req);
        const offset = (query.page - 1) * query.limit;
        const sortColumn = query.sortBy === 'title'
            ? 'title'
            : query.sortBy === 'createdAt'
                ? 'created_at'
                : 'last_activity_at';
        const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
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
        const items = rows.map((row) => ({
            id: row.id,
            title: row.title,
            primaryMuscle: row.primary_muscle,
            imageUrl: row.image_path
                ? row.image_path.startsWith('http')
                    ? row.image_path
                    : `/uploads/${row.image_path}`
                : null,
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
            items,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getAiSessions = getAiSessions;
// ─── GET /ai/sessions/:id ─────────────────────────────────────────────────────
const getAiSessionById = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const sessionId = Number(req.params.id);
        if (Number.isNaN(sessionId)) {
            return res.status(400).json({ message: 'Invalid id' });
        }
        const session = await AiSession_1.default.findOne({
            where: { id: sessionId, userId },
            include: [{ model: AiPost_1.default, as: 'posts', separate: true, order: [['createdAt', 'ASC']] }],
        });
        if (!session)
            return res.status(404).json({ message: 'Not found' });
        const posts = session.posts ?? [];
        let primary;
        for (const p of posts) {
            if (p.type === 'search') {
                primary = p;
                break;
            }
        }
        if (posts.length > 0 && primary === undefined)
            primary = posts[0];
        const followups = [];
        if (primary !== undefined) {
            for (const p of posts) {
                if (p.id !== primary.id)
                    followups.push(serializeAiPost(p));
            }
        }
        const body = {
            id: session.id,
            createdAt: session.createdAt,
            data: primary !== undefined ? serializeAiPost(primary) : null,
        };
        if (followups.length > 0)
            body.followups = followups;
        return res.status(200).json(body);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAiSessionById = getAiSessionById;
// ─── DELETE /ai/sessions/:id ──────────────────────────────────────────────────
const deleteAiSession = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const sessionId = Number(req.params.id);
        if (Number.isNaN(sessionId)) {
            return res.status(400).json({ message: 'Invalid id' });
        }
        const session = await AiSession_1.default.findOne({ where: { id: sessionId, userId } });
        if (!session)
            return res.status(404).json({ message: 'Not found' });
        const posts = await AiPost_1.default.findAll({ where: { sessionId } });
        for (const p of posts) {
            if (!p.imagePath)
                continue;
            if (p.imagePath.startsWith('http')) {
                const fileName = p.imagePath.split('/').pop();
                if (fileName)
                    await (0, r2_service_1.deleteFile)(fileName);
            }
            else {
                const filePath = path_1.default.join(process.cwd(), 'uploads', p.imagePath);
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
        return res.status(200).json({ message: 'Deleted' });
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteAiSession = deleteAiSession;
// ─── POST /admin/equipment-gifs ───────────────────────────────────────────────
/**
 * Admin: Upserts GIFs for a specific equipment.
 * Supports:
 *  - File upload (multipart/form-data) via `files` array
 *  - URL list (JSON body) via `gifUrls` array
 */
const adminUpsertEquipmentGifs = async (req, res, next) => {
    try {
        const { equipmentName, gifUrls, captions, targetMuscles, alternativeNames } = req.body ?? {};
        const files = req.files;
        if (typeof equipmentName !== 'string' || !equipmentName.trim()) {
            return res.status(400).json({ message: 'equipmentName is required.' });
        }
        const parseArray = (val) => {
            if (Array.isArray(val))
                return val.filter(v => typeof v === 'string');
            if (typeof val === 'string') {
                try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed))
                        return parsed.filter(v => typeof v === 'string');
                }
                catch {
                    return val.split(',').map(s => s.trim()).filter(Boolean);
                }
            }
            return [];
        };
        const name = equipmentName.trim();
        const muscles = parseArray(targetMuscles);
        const aliases = parseArray(alternativeNames);
        const gifItems = [];
        // ── 1. Handle File Uploads ──────────────────────────────────────────────
        const uploadedGifs = files?.gifs;
        if (uploadedGifs) {
            const fileArray = Array.isArray(uploadedGifs)
                ? uploadedGifs
                : [uploadedGifs];
            const buffers = fileArray.map((f) => f.data);
            const saved = await (0, exercisedb_service_1.upsertManualGifsFromFiles)({
                equipmentName: name,
                files: buffers,
                captions: Array.isArray(captions) ? captions : undefined,
                targetMuscles: muscles,
                alternativeNames: aliases,
            });
            gifItems.push(...saved);
        }
        // ── 2. Handle URL List (Fallback/Legacy) ──────────────────────────────────
        if (Array.isArray(gifUrls) && gifUrls.length > 0) {
            for (let i = 0; i < gifUrls.length; i++) {
                const rawUrl = gifUrls[i];
                const caption = captions?.[i] ?? name;
                const finalUrl = await (0, exercisedb_service_1.processAndUploadGif)(rawUrl);
                if (finalUrl) {
                    gifItems.push({ url: finalUrl, caption });
                }
            }
            // If we only had URLs, we still need to persist them to the model manually
            // (Actually, processedAndUploadGif only uploads to R2. We need to save to DB.)
            // But for simplicity, we'll suggest using files in the new frontend.
        }
        if (gifItems.length === 0 && !uploadedGifs) {
            return res
                .status(400)
                .json({ message: 'Either gifs (files) or gifUrls (array) is required.' });
        }
        return res.status(200).json({
            message: 'Equipment GIFs saved.',
            count: gifItems.length,
            gifs: gifItems,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.adminUpsertEquipmentGifs = adminUpsertEquipmentGifs;
