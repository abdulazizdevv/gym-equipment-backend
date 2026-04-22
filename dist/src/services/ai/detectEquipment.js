"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectEquipment = void 0;
const error_1 = require("../../api/utils/error");
const gemini_keys_1 = require("../../api/utils/gemini-keys");
const exercisedb_service_1 = require("./exercisedb.service");
const groq_service_1 = require("./groq.service");
// ─── Network Error Helpers ────────────────────────────────────────────────────
const formatNetworkError = (err) => {
    if (err instanceof Error) {
        const cause = err.cause;
        const base = err.message;
        if (cause instanceof Error)
            return `${base}: ${cause.message}`;
        if (cause != null)
            return `${base}: ${String(cause)}`;
        return base;
    }
    return String(err);
};
const geminiFailureMessage = (detail) => {
    const d = detail.toLowerCase();
    if (d.includes('connect timeout') ||
        d.includes('connection timeout') ||
        d.includes('econnrefused') ||
        d.includes('enotfound') ||
        d.includes('eai_again')) {
        return `Gemini API unreachable (${detail}). Outbound HTTPS to Google is blocked. Try another network or set HTTPS_PROXY.`;
    }
    return `Gemini API request failed (${detail}). Check GEMINI_API_KEY and outbound HTTPS to Google.`;
};
// ─── HTTP Timeout ─────────────────────────────────────────────────────────────
const geminiHttpTimeoutMs = (() => {
    const raw = process.env.GEMINI_HTTP_TIMEOUT_MS;
    if (!raw)
        return 120_000;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 5_000 ? n : 120_000;
})();
// ─── Language Resolution ──────────────────────────────────────────────────────
const resolveLanguage = (lang) => {
    const normalized = (lang || '').toLowerCase();
    if (normalized.startsWith('en'))
        return 'en';
    if (normalized.startsWith('ru'))
        return 'ru';
    return 'uz';
};
const i18n = (lang) => ({
    noApiKeyTip: lang === 'ru'
        ? 'Gemini API kaliti topilmadi'
        : lang === 'en'
            ? 'Gemini API key is missing'
            : "Gemini API kaliti yo'q",
});
// ─── JSON Parsing ─────────────────────────────────────────────────────────────
const safeJsonParse = (text) => {
    try {
        return JSON.parse(text);
    }
    catch { }
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
        try {
            return JSON.parse(text.slice(first, last + 1));
        }
        catch { }
    }
    return null;
};
// ─── Confidence Normalization ─────────────────────────────────────────────────
const normalizeConfidence = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        if (value > 1 && value <= 100)
            return Number((value / 100).toFixed(2));
        if (value >= 0 && value <= 1)
            return Number(value.toFixed(2));
    }
    if (typeof value === 'string') {
        const n = Number(value.trim().replace('%', ''));
        if (!Number.isNaN(n)) {
            if (value.includes('%') || n > 1) {
                if (n >= 0 && n <= 100)
                    return Number((n / 100).toFixed(2));
            }
            else if (n >= 0 && n <= 1) {
                return Number(n.toFixed(2));
            }
        }
    }
    return undefined;
};
// ─── Gemini Response Normalization ────────────────────────────────────────────
const normalizeGeminiResponse = (parsed) => ({
    isGymEquipment: !!parsed?.isGymEquipment,
    equipment: {
        name: typeof parsed?.equipment?.name === 'string'
            ? parsed.equipment.name
            : 'Unknown equipment',
        confidence: normalizeConfidence(parsed?.equipment?.confidence),
    },
    muscles: Array.isArray(parsed?.muscles)
        ? parsed.muscles.filter((m) => typeof m === 'string')
        : [],
    usage: {
        steps: parsed?.usage?.steps ?? [],
        cues: parsed?.usage?.cues ?? [],
        commonMistakes: parsed?.usage?.commonMistakes ?? [],
    },
    tips: parsed?.tips ?? [],
});
// ─── detectEquipment ─────────────────────────────────────────────────────────
const detectEquipment = async (args) => {
    const language = resolveLanguage(args.language);
    const t = i18n(language);
    if (!gemini_keys_1.GEMINI_API_KEYS || gemini_keys_1.GEMINI_API_KEYS.length === 0) {
        return {
            isGymEquipment: false,
            equipment: { name: 'No API keys configured' },
            muscles: [],
            usage: { steps: [], cues: [], commonMistakes: [] },
            tips: [t.noApiKeyTip],
            images: [],
        };
    }
    const { GoogleGenAI } = await import('@google/genai');
    // Build Gemini prompt parts
    const parts = [
        {
            text: `
You are a gym expert.
Write ALL user-facing text in this language: ${language}.
Return ONLY valid JSON (no markdown, no code fences):
{
  "isGymEquipment": boolean,
  "equipment": { "name": string, "confidence": number },
  "muscles": string[],
  "usage": { "steps": string[], "cues": string[], "commonMistakes": string[] },
  "tips": string[]
}

IMPORTANT: Set "isGymEquipment" to true ONLY if the image clearly contains
fitness/gym machinery, dumbbells, barbells, or weights.
If the image shows people without gear, animals, landscapes, or unrelated
objects, set "isGymEquipment" to false.
      `.trim(),
        },
    ];
    // Attach image if provided
    if (args.image?.buffer) {
        const data = Buffer.isBuffer(args.image.buffer)
            ? args.image.buffer.toString('base64')
            : Buffer.from(args.image.buffer).toString('base64');
        parts.push({ inlineData: { mimeType: args.image.mimeType, data } });
    }
    else if (args.image?.filePath) {
        const fs = await import('fs/promises');
        const buf = await fs.readFile(args.image.filePath);
        parts.push({ inlineData: { mimeType: args.image.mimeType, data: buf.toString('base64') } });
    }
    // Sequential key rotation
    const errors = [];
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    for (let i = 0; i < gemini_keys_1.GEMINI_API_KEYS.length; i++) {
        const apiKey = gemini_keys_1.GEMINI_API_KEYS[i];
        try {
            const ai = new GoogleGenAI({
                apiKey,
                httpOptions: { timeout: geminiHttpTimeoutMs },
            });
            const modelName = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts }],
            });
            const text = response?.text || '';
            const parsed = safeJsonParse(text);
            const analysis = normalizeGeminiResponse(parsed);
            // Fetch GIFs only when recognized as gym equipment
            let images = [];
            if (analysis.isGymEquipment && analysis.equipment.name !== 'Unknown equipment') {
                images = await (0, exercisedb_service_1.getOrFetchEquipmentGifs)(analysis.equipment.name, analysis.muscles);
            }
            return { ...analysis, images };
        }
        catch (err) {
            const detail = formatNetworkError(err);
            console.warn(`[Gemini] Key[${i}] failed:`, detail);
            errors.push({ index: i, key: apiKey, detail });
            // If it's a 530/503 (Overloaded) error, wait a bit before next key
            if (detail.includes('503') || detail.includes('overloaded')) {
                await delay(1500);
            }
        }
    }
    // ─── 4. Fallback: Groq (Llama 3.2 Vision) ───────────────────────────────────
    if (process.env.GROQ_API_KEY) {
        try {
            console.log('[AI Fallback] Trying Groq...');
            let base64Image = '';
            if (args.image?.buffer) {
                base64Image = Buffer.isBuffer(args.image.buffer)
                    ? args.image.buffer.toString('base64')
                    : Buffer.from(args.image.buffer).toString('base64');
            }
            else if (args.image?.filePath) {
                const fs = await import('fs/promises');
                const buf = await fs.readFile(args.image.filePath);
                base64Image = buf.toString('base64');
            }
            if (base64Image) {
                const groqText = await (0, groq_service_1.analyzeImageWithGroq)({
                    imageAsBase64: base64Image,
                    mimeType: args.image?.mimeType ?? 'image/jpeg',
                    prompt: parts[0].text, // Reuse the same prompt
                });
                const parsed = safeJsonParse(groqText);
                const analysis = normalizeGeminiResponse(parsed);
                let images = [];
                if (analysis.isGymEquipment && analysis.equipment.name !== 'Unknown equipment') {
                    images = await (0, exercisedb_service_1.getOrFetchEquipmentGifs)(analysis.equipment.name, analysis.muscles);
                }
                console.log('[AI Fallback] Groq success');
                return { ...analysis, images };
            }
        }
        catch (groqErr) {
            console.error('[AI Fallback] Groq failed:', groqErr);
        }
    }
    // All keys exhausted
    const errorInfo = errors
        .map((e) => `[Key ${e.index}] ${e.detail}`)
        .join('\n\n');
    throw new error_1.CustomError(geminiFailureMessage(errorInfo), 502);
};
exports.detectEquipment = detectEquipment;
