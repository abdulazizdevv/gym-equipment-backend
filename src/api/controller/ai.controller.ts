import { NextFunction, Request, Response } from 'express';
import { v4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { QueryTypes } from 'sequelize';
import AiSession from '../../models/AiSession';
import AiPost from '../../models/AiPost';
import { detectEquipment } from '../../services/ai/detectEquipment';
import { sequelize } from '../../database/connection';

interface AuthRequest extends Request {
  userId?: number;
}

type SessionsQuery = {
  page: number;
  limit: number;
  q: string | null;
  sortBy: 'createdAt' | 'lastActivityAt' | 'title';
  order: 'asc' | 'desc';
};

const parseSessionsQuery = (req: Request): SessionsQuery => {
  const rawPage = Number(req.query.page);
  const rawLimit = Number(req.query.limit);

  const page =
    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 50)
      : 10;

  const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const q = qRaw.length > 0 ? qRaw.toLowerCase() : null;

  const sortByRaw =
    typeof req.query.sortBy === 'string' ? req.query.sortBy.trim() : '';
  const sortBy: SessionsQuery['sortBy'] =
    sortByRaw === 'createdAt' ||
    sortByRaw === 'title' ||
    sortByRaw === 'lastActivityAt'
      ? sortByRaw
      : 'lastActivityAt';

  const orderRaw =
    typeof req.query.order === 'string'
      ? req.query.order.trim().toLowerCase()
      : '';
  const order: SessionsQuery['order'] = orderRaw === 'asc' ? 'asc' : 'desc';

  return { page, limit, q, sortBy, order };
};

const getRequestLanguage = (req: Request): string => {
  const lang = req.headers.lang;
  if (typeof lang === 'string' && lang.trim()) return lang.trim();

  const xLang = req.headers['x-lang'];
  if (typeof xLang === 'string' && xLang.trim()) return xLang.trim();

  const acceptLanguage = req.headers['accept-language'];
  if (typeof acceptLanguage === 'string' && acceptLanguage.trim()) {
    const first = acceptLanguage.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'uz';
};

const getUploadedImage = (
  req: Request,
): { file: any; ext: string; imageName: string } | null => {
  const files = (req as any).files as undefined | Record<string, any>;
  const image = files?.image;
  if (!image) return null;

  const file = Array.isArray(image) ? image[0] : image;
  const ext = (file.mimetype?.split('/')?.[1] ?? 'jpg').toLowerCase();
  const imageName = `${v4()}.${ext}`;

  return { file, ext, imageName };
};

const extToMime = (ext: string): string => {
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  return 'image/jpeg';
};

export const postAiEquipment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const language = getRequestLanguage(req);

    const { sessionId, question } = req.body ?? {};

    // SEARCH mode: client uploads `image`
    const uploaded = getUploadedImage(req);
    if (uploaded) {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir))
        fs.mkdirSync(uploadsDir, { recursive: true });

      const imagePathFs = path.join(uploadsDir, uploaded.imageName);
      uploaded.file.mv(imagePathFs);

      const session = await AiSession.create({ userId });
      const createdSessionId = session.dataValues.id;
      const result = await detectEquipment({
        image: {
          filePath: imagePathFs,
          url: `/uploads/${uploaded.imageName}`,
          mimeType: extToMime(uploaded.ext),
        },
        question: typeof question === 'string' ? question : undefined,
        history: [],
        language,
      });

      const post = await AiPost.create({
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
        imageUrl: `/uploads/${uploaded.imageName}`,
        postId: post.id,
        data: result,
      });
    }

    // FOLLOWUP mode: client sends `question` and `sessionId`
    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId is required.' });
    }

    const parsedSessionId =
      typeof sessionId === 'number' ? sessionId : Number(sessionId);
    if (Number.isNaN(parsedSessionId)) {
      return res.status(400).json({ message: 'sessionId must be a number.' });
    }

    const session = await AiSession.findOne({
      where: { id: parsedSessionId, userId },
    });
    if (!session) return res.status(403).json({ message: 'Access denied.' });

    if (
      !question ||
      typeof question !== 'string' ||
      question.trim().length === 0
    ) {
      return res.status(400).json({ message: 'question is required.' });
    }

    const posts = await AiPost.findAll({
      where: { sessionId: parsedSessionId },
      order: [['createdAt', 'ASC']],
    });

    const history = posts.map((p) => ({
      type: p.type,
      request: p.requestJson,
      result: p.resultJson,
    }));

    // New AI call for each follow-up turn.
    const result = await detectEquipment({
      question,
      history,
      language,
    });

    const post = await AiPost.create({
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
  } catch (error) {
    return next(error);
  }
};

export const getAiSessions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const query = parseSessionsQuery(req);
    const offset = (query.page - 1) * query.limit;
    const sortColumn =
      query.sortBy === 'title'
        ? 'title'
        : query.sortBy === 'createdAt'
          ? 'created_at'
          : 'last_activity_at';
    const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';

    const rows = await sequelize.query<{
      id: number;
      title: string;
      primary_muscle: string | null;
      image_path: string | null;
      created_at: string;
      last_activity_at: string;
      post_count: number;
      total_count: number;
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
    );

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
  } catch (error) {
    return next(error);
  }
};

export const getAiSessionById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const sessionId = Number(req.params.id);
    if (Number.isNaN(sessionId)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const session = await AiSession.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) return res.status(404).json({ message: 'Not found' });

    const posts = await AiPost.findAll({
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
  } catch (error) {
    return next(error);
  }
};

export const deleteAiSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const sessionId = Number(req.params.id);
    if (Number.isNaN(sessionId)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const session = await AiSession.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) return res.status(404).json({ message: 'Not found' });

    const posts = await AiPost.findAll({ where: { sessionId } });
    for (const p of posts) {
      const imagePath = p.dataValues.imagePath;
      if (imagePath) {
        const filePath = path.join(process.cwd(), 'uploads', imagePath);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {}
        }
      }
    }

    await AiPost.destroy({ where: { sessionId } });
    await AiSession.destroy({ where: { id: sessionId } });

    return res.status(200).json({ message: 'Deleted' });
  } catch (error) {
    return next(error);
  }
};
