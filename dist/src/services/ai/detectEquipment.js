"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectEquipment = exports.generateExerciseIllustrationWithOpenAI = void 0;
const error_1 = require("../../api/utils/error");
const r2_service_1 = require("../storage/r2.service");
const image_service_1 = require("../storage/image.service");
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
/** Connect / DNS / TLS issues — not invalid API key (those are usually HTTP 401/403). */
const geminiFailureMessage = (detail) => {
    const d = detail.toLowerCase();
    if (d.includes("connect timeout") ||
        d.includes("connection timeout") ||
        d.includes("econnrefused") ||
        d.includes("enotfound") ||
        d.includes("eai_again")) {
        return `Gemini API unreachable (${detail}). Outbound HTTPS to Google is blocked, filtered, or too slow (firewall, VPN, ISP, corporate proxy). Try another network or mobile hotspot; set HTTPS_PROXY if required. A wrong GEMINI_API_KEY normally returns 401/403, not a connect timeout. Optional: GEMINI_HTTP_TIMEOUT_MS (default 120000).`;
    }
    return `Gemini API request failed (${detail}). Check GEMINI_API_KEY, outbound HTTPS to Google, and firewall/VPN. Optional: GEMINI_HTTP_TIMEOUT_MS.`;
};
const geminiHttpTimeoutMs = (() => {
    const raw = process.env.GEMINI_HTTP_TIMEOUT_MS;
    if (raw == null || raw === "")
        return 120_000;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 5_000 ? n : 120_000;
})();
const resolveLanguage = (lang) => {
    const normalized = (lang || "").toLowerCase();
    if (normalized.startsWith("en"))
        return "en";
    if (normalized.startsWith("ru"))
        return "ru";
    return "uz";
};
const t = (lang) => ({
    uploadedImage: lang === "ru"
        ? "Загруженное изображение пользователя"
        : lang === "en"
            ? "User uploaded image"
            : "Foydalanuvchi yuklagan rasm",
    generatedImage: lang === "ru"
        ? "Сгенерированная анатомическая иллюстрация"
        : lang === "en"
            ? "Generated anatomical illustration"
            : "Generatsiya qilingan anatomik illyustratsiya",
    noApiKeyTip: lang === "ru"
        ? "Gemini API kaliti topilmadi"
        : lang === "en"
            ? "Gemini API key is missing"
            : "Gemini API kaliti yo‘q",
});
const safeJsonParse = (text) => {
    try {
        return JSON.parse(text);
    }
    catch { }
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
        try {
            return JSON.parse(text.slice(first, last + 1));
        }
        catch { }
    }
    return null;
};
const normalizeConfidence = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        if (value > 1 && value <= 100)
            return Number((value / 100).toFixed(2));
        if (value >= 0 && value <= 1)
            return Number(value.toFixed(2));
    }
    if (typeof value === "string") {
        const n = Number(value.trim().replace("%", ""));
        if (!Number.isNaN(n)) {
            if (value.includes("%") || n > 1) {
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
const inferExerciseName = (equipmentName) => {
    const name = equipmentName.toLowerCase();
    if (name.includes("bike") ||
        name.includes("velosiped") ||
        name.includes("spin"))
        return "indoor cycling";
    if (name.includes("lat") || name.includes("pulldown"))
        return "lat pulldown";
    if (name.includes("treadmill") || name.includes("yugur"))
        return "running/walking";
    if (name.includes("row"))
        return "seated row";
    if (name.includes("chest") || name.includes("press"))
        return "chest press";
    if (name.includes("leg") || name.includes("extension"))
        return "leg extension";
    if (name.includes("multi") || name.includes("home gym"))
        return "lat pulldown";
    return "strength training exercise";
};
const normalizeGeminiResponse = (parsed) => {
    return {
        equipment: {
            name: typeof parsed?.equipment?.name === "string"
                ? parsed.equipment.name
                : "Unknown equipment",
            confidence: typeof parsed?.equipment?.confidence === "number"
                ? parsed.equipment.confidence
                : undefined,
        },
        muscles: Array.isArray(parsed?.muscles)
            ? parsed.muscles.filter((m) => typeof m === "string")
            : [],
        usage: {
            steps: parsed?.usage?.steps || [],
            cues: parsed?.usage?.cues || [],
            commonMistakes: parsed?.usage?.commonMistakes || [],
        },
        tips: parsed?.tips || [],
        images: Array.isArray(parsed?.images)
            ? parsed.images.filter((img) => img?.url)
            : [],
    };
};
const generateExerciseIllustrationWithOpenAI = async ({ equipmentName, muscles, language, }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        return [];
    try {
        const OpenAI = (await import("openai")).default;
        const { v4 } = await import("uuid");
        const client = new OpenAI({ apiKey });
        const exerciseName = inferExerciseName(equipmentName);
        const primaryMuscle = muscles[0] || "latissimus dorsi";
        const secondaryMuscles = muscles.slice(1, 6).join(", ") ||
            "biceps, rear deltoids, trapezius, rhomboids";
        const prompt = ` 
Professional fitness anatomy diagram in the style of a textbook plate: one figure, one machine, high clarity. 
 
EQUIPMENT (must be prominent and technically believable): 
- Depict the specific apparatus for this movement: "${equipmentName}" (exercise type: ${exerciseName}). 
- Show the FULL machine in frame: frame, weight stack or load system, cables and pulleys where applicable, handles/bar/pads/seat/rollers/platform as appropriate. 
- Materials: matte metal greys, black padding, rubber feet; clean industrial gym look. 
- Cables run logically from stack to handles; user contact points (thigh pads, chest pad, foot plate) match how this machine is really used. 
- No floating or incomplete equipment — the setup must read as a real, usable station. 
 
FIGURE AND POSE: 
- One athletic adult human body (realistic proportions — not a grey dummy). 
- Clothing: plain athletic t-shirt and short-inseam gym shorts (brief length, well above the knee). Solid neutral colors only — absolutely no writing, logos, or graphics on fabric. 
- Mid-repetition pose: correct joint angles, stable spine, safe alignment for this exercise on THIS machine. 
- Hands/feet on the real grips and supports of the depicted machine. 
 
MUSCLE HIGHLIGHTING (strict contrast diagram style): 
- Primary muscle (${primaryMuscle}) → BRIGHT RED, high saturation, sharp edges, slight glow 
- Secondary muscles (${secondaryMuscles}) → ORANGE, clearly visible but less intense than red 
 
- ALL OTHER BODY AREAS: 
  must be flat LIGHT GRAY, low detail, desaturated, almost faded 
 
STRICT RULES: 
- Do NOT color the entire body 
- Do NOT use natural skin tones 
- Only active muscles have color 
- Everything else must look inactive and neutral 
 
COMPOSITION AND VISUAL CONTRAST: 
 
- Clean educational anatomy illustration on a plain white or very light neutral background 
- Subtle ground shadow allowed, no distractions 
 
- Camera angle must clearly show: 
  • the FULL ${equipmentName} machine 
  • the mannequin performing the exercise 
  • the active muscle groups in a single clear view (side or 3/4 angle) 
 
- Image must be sharp, high detail, textbook-style (not cinematic, not blurry) 
 
VISUAL CONTRAST RULE (VERY IMPORTANT): 
- Primary (RED) and secondary (ORANGE) muscles must immediately stand out at first glance 
- These active muscles should be the most visually dominant elements in the image 
 
- ALL other body areas must be: 
  • flat light gray 
  • low contrast 
  • visually faded into the background 
 
- The inactive body must visually recede so that active muscles are instantly recognizable 
 
EQUIPMENT RULES: 
- Machine must be fully visible and realistic 
- No labels, no text, no logos, no numbers, no display screens 
- Clean metal and padding only 
 
TEXT / BRANDING (strict — image must be 100% text-free): 
- Zero text anywhere: no letters, numbers, symbols, UI, posters, signs, shoe branding, screen readouts, weight-stack numbers, or arrows with words. 
- No watermarks, no logos, no captions, no text. 
 
SAFETY / STYLE RULES: 
- Athletic context only: short gym shorts are normal sportswear; no nudity; no sexualized posing or camera angle. 
- Exactly one person; no crowd. 
`.trim();
        const result = await client.images.generate({
            model: "dall-e-3",
            prompt,
            size: "1024x1024",
            // Default API response is `url`; we persist files locally so we need base64.
            response_format: "b64_json",
        });
        const row = result.data?.[0];
        const b64 = row?.b64_json;
        const remoteUrl = row?.url;
        const fileName = `${v4()}.png`;
        let finalUrl = "";
        if (b64) {
            const buffer = Buffer.from(b64, "base64");
            const optimized = await (0, image_service_1.optimizeImage)(buffer);
            finalUrl = await (0, r2_service_1.uploadFile)(optimized.buffer, `${v4()}.webp`, optimized.mimeType);
        }
        else if (remoteUrl) {
            const imgRes = await fetch(remoteUrl);
            if (!imgRes.ok)
                return [];
            const buffer = new Uint8Array(await imgRes.arrayBuffer());
            const optimized = await (0, image_service_1.optimizeImage)(buffer);
            finalUrl = await (0, r2_service_1.uploadFile)(optimized.buffer, `${v4()}.webp`, optimized.mimeType);
        }
        else {
            return [];
        }
        return [finalUrl];
    }
    catch (err) {
        console.error("OpenAI image error:", err);
        return [];
    }
};
exports.generateExerciseIllustrationWithOpenAI = generateExerciseIllustrationWithOpenAI;
const detectEquipment = async (args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const language = resolveLanguage(args.language);
    const i18n = t(language);
    if (!apiKey) {
        return {
            equipment: { name: "No API key" },
            muscles: [],
            usage: { steps: [], cues: [], commonMistakes: [] },
            tips: [i18n.noApiKeyTip],
            images: [],
        };
    }
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { timeout: geminiHttpTimeoutMs },
    });
    const parts = [
        {
            text: `
You are a gym expert.
Write ALL user-facing text in this language: ${language}.
Return ONLY JSON:
{
  "equipment": { "name": string, "confidence": number },
  "muscles": string[],
  "usage": { "steps": string[], "cues": string[], "commonMistakes": string[] },
  "tips": string[],
  "images": []
}
      `,
        },
    ];
    // user image qo‘shish
    if (args.image?.buffer) {
        const data = Buffer.isBuffer(args.image.buffer)
            ? args.image.buffer.toString("base64")
            : Buffer.from(args.image.buffer).toString("base64");
        parts.push({
            inlineData: {
                mimeType: args.image.mimeType,
                data,
            },
        });
    }
    else if (args.image?.filePath) {
        const fs = await import("fs/promises");
        const buf = await fs.readFile(args.image.filePath);
        parts.push({
            inlineData: {
                mimeType: args.image.mimeType,
                data: buf.toString("base64"),
            },
        });
    }
    // Gemini chaqirish
    let response;
    try {
        response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts }],
        });
    }
    catch (err) {
        throw new error_1.CustomError(geminiFailureMessage(formatNetworkError(err)), 502);
    }
    const text = response?.text || "";
    const parsed = safeJsonParse(text);
    // normalize
    const normalized = normalizeGeminiResponse(parsed);
    // Image generation is now separated and called via a dedicated endpoint.
    // We no longer automatically call generateExerciseIllustrationWithOpenAI.
    return normalized;
};
exports.detectEquipment = detectEquipment;
