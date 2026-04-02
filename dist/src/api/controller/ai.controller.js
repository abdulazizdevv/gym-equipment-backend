"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAiSession = exports.getAiSessionById = exports.getAiSessions = exports.postAiEquipment = void 0;
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const AiSession_1 = __importDefault(require("../../models/AiSession"));
const AiPost_1 = __importDefault(require("../../models/AiPost"));
const detectEquipment_1 = require("../../services/ai/detectEquipment");
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
const extToMime = (ext) => {
    const e = ext.toLowerCase();
    if (e === 'png')
        return 'image/png';
    if (e === 'webp')
        return 'image/webp';
    if (e === 'gif')
        return 'image/gif';
    return 'image/jpeg';
};
const postAiEquipment = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const language = getRequestLanguage(req);
        const { sessionId, question } = req.body ?? {};
        // SEARCH mode: client uploads `image`
        const uploaded = getUploadedImage(req);
        if (uploaded) {
            const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
            if (!fs_1.default.existsSync(uploadsDir))
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            const imagePathFs = path_1.default.join(uploadsDir, uploaded.imageName);
            uploaded.file.mv(imagePathFs);
            const session = await AiSession_1.default.create({ userId });
            const createdSessionId = session.dataValues.id;
            const result = await (0, detectEquipment_1.detectEquipment)({
                image: {
                    filePath: imagePathFs,
                    url: `/uploads/${uploaded.imageName}`,
                    mimeType: extToMime(uploaded.ext),
                },
                question: typeof question === 'string' ? question : undefined,
                history: [],
                language,
            });
            const post = await AiPost_1.default.create({
                sessionId: createdSessionId,
                type: 'search',
                imagePath: uploaded.imageName,
                requestJson: {
                    question: typeof question === 'string' ? question : null,
                },
                resultJson: result,
            });
            return res.status(200).json({
                type: 'search',
                sessionId: createdSessionId,
                postId: post.id,
                data: result,
            });
        }
        // FOLLOWUP mode: client sends `question` and `sessionId`
        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required.' });
        }
        const parsedSessionId = typeof sessionId === 'number' ? sessionId : Number(sessionId);
        if (Number.isNaN(parsedSessionId)) {
            return res.status(400).json({ message: 'sessionId must be a number.' });
        }
        const session = await AiSession_1.default.findOne({
            where: { id: parsedSessionId, userId },
        });
        if (!session)
            return res.status(403).json({ message: 'Access denied.' });
        if (!question ||
            typeof question !== 'string' ||
            question.trim().length === 0) {
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
        // New AI call for each follow-up turn.
        const result = await (0, detectEquipment_1.detectEquipment)({
            question,
            history,
            language,
        });
        const post = await AiPost_1.default.create({
            sessionId: session.dataValues.id,
            type: 'followup',
            imagePath: null,
            requestJson: {
                question,
            },
            resultJson: result,
        });
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
const getAiSessions = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const sessions = await AiSession_1.default.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']],
        });
        return res.status(200).json(sessions.map((s) => ({
            id: s.dataValues.id,
            createdAt: s.dataValues.createdAt,
        })));
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
            return res.status(401).json({ message: 'Unauthorized' });
        const sessionId = Number(req.params.id);
        if (Number.isNaN(sessionId)) {
            return res.status(400).json({ message: 'Invalid id' });
        }
        const session = await AiSession_1.default.findOne({
            where: { id: sessionId, userId },
        });
        if (!session)
            return res.status(404).json({ message: 'Not found' });
        const posts = await AiPost_1.default.findAll({
            where: { sessionId },
            order: [['createdAt', 'ASC']],
        });
        return res.status(200).json({
            id: session.dataValues.id,
            createdAt: session.dataValues.createdAt,
            posts: posts.map((p) => ({
                id: p.dataValues.id,
                type: p.dataValues.type,
                imageUrl: p.dataValues.imagePath
                    ? `/uploads/${p.dataValues.imagePath}`
                    : null,
                request: p.dataValues.requestJson,
                result: p.dataValues.resultJson,
                createdAt: p.dataValues.createdAt,
            })),
        });
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
            return res.status(401).json({ message: 'Unauthorized' });
        const sessionId = Number(req.params.id);
        if (Number.isNaN(sessionId)) {
            return res.status(400).json({ message: 'Invalid id' });
        }
        const session = await AiSession_1.default.findOne({
            where: { id: sessionId, userId },
        });
        if (!session)
            return res.status(404).json({ message: 'Not found' });
        const posts = await AiPost_1.default.findAll({ where: { sessionId } });
        for (const p of posts) {
            const imagePath = p.dataValues.imagePath;
            if (imagePath) {
                const filePath = path_1.default.join(process.cwd(), 'uploads', imagePath);
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
