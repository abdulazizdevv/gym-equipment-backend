"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertManualGifsFromFiles = exports.getOrFetchEquipmentGifs = exports.processAndUploadGif = exports.normalizeEquipmentKey = void 0;
const uuid_1 = require("uuid");
const sharp_1 = __importDefault(require("sharp"));
const sequelize_1 = require("sequelize");
const r2_service_1 = require("../storage/r2.service");
const EquipmentGif_1 = __importDefault(require("../../models/EquipmentGif"));
// ─── Constants ────────────────────────────────────────────────────────────────
const FALLBACK_KEY = 'universal_fallback';
// ─── Equipment Key Normalization ──────────────────────────────────────────────
/**
 * Converts any equipment name into a stable lowercase DB key.
 * Special case: "Universal Fallback" -> "universal_fallback"
 */
const normalizeEquipmentKey = (name) => {
    const n = name.toLowerCase().trim();
    if (n === 'universal fallback' || n === 'universal_fallback') {
        return FALLBACK_KEY;
    }
    return n
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
};
exports.normalizeEquipmentKey = normalizeEquipmentKey;
// ─── GIF Processing & Upload ──────────────────────────────────────────────────
/**
 * Processes a GIF (upscale, sharpen) and uploads it to Cloudflare R2.
 * Input can be a public URL or a raw Buffer.
 * Returns the public R2 URL, or null on failure.
 */
const processAndUploadGif = async (input) => {
    try {
        let inputBuffer;
        if (typeof input === 'string') {
            const response = await fetch(input);
            if (!response.ok)
                return null;
            inputBuffer = Buffer.from(await response.arrayBuffer());
        }
        else {
            inputBuffer = input;
        }
        let finalBuffer = inputBuffer;
        let mimeType = 'image/gif';
        let extension = 'gif';
        try {
            const metadata = await (0, sharp_1.default)(inputBuffer).metadata();
            const isWebP = metadata.format === 'webp';
            // 🔥 UPSCALE & SHARPEN 🔥
            const pipeline = (0, sharp_1.default)(inputBuffer, { animated: true }).resize(720, 720, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 },
            })
                .sharpen({
                sigma: 1,
                m1: 2,
                m2: 10,
            });
            if (isWebP) {
                finalBuffer = await pipeline.webp({ quality: 80 }).toBuffer();
                mimeType = 'image/webp';
                extension = 'webp';
            }
            else {
                finalBuffer = await pipeline.gif({ colors: 128 }).toBuffer();
                mimeType = 'image/gif';
                extension = 'gif';
            }
        }
        catch (sharpErr) {
            console.error('[GIF Process] Sharp processing failed, falling back to original:', sharpErr);
            finalBuffer = inputBuffer;
        }
        const fileName = `equipment-gifs/${(0, uuid_1.v4)()}.${extension}`;
        return await (0, r2_service_1.uploadFile)(new Uint8Array(finalBuffer), fileName, mimeType);
    }
    catch (err) {
        console.error('[GIF Process] process/upload failed:', err);
        return null;
    }
};
exports.processAndUploadGif = processAndUploadGif;
// ─── Smart Local Matching Logic ──────────────────────────────────────────────
/**
 * Returns cached GIFs from DB using Smart Matching.
 * NO longer uses external ExerciseDB API.
 *
 * Logic:
 * 1. Exact Match (Key, RawName, Aliases)
 * 2. Fuzzy Keyword Match (Score-based)
 * 3. Muscle Overlap Match
 * 4. Universal Fallback
 */
const getOrFetchEquipmentGifs = async (equipmentName, targetMuscles = []) => {
    const key = (0, exports.normalizeEquipmentKey)(equipmentName);
    const normalizedInput = equipmentName.toLowerCase().trim();
    // ── 1. Direct Match ────────────────────────────────────────────────────────
    const directMatch = await EquipmentGif_1.default.findOne({
        where: {
            [sequelize_1.Op.or]: [
                { equipmentKey: key },
                { rawName: { [sequelize_1.Op.iLike]: `%${normalizedInput}%` } },
                { alternativeNames: { [sequelize_1.Op.contains]: [normalizedInput] } },
            ],
        },
    });
    if (directMatch && directMatch.gifs.length > 0) {
        console.log(`[SmartMatch] Direct hit for "${equipmentName}"`);
        return directMatch.gifs;
    }
    // ── 2. Fuzzy Keyword & Muscle Matching ─────────────────────────────────────
    // Fetch all manual entries to do scoring (usually small number of machines)
    const allManualItems = await EquipmentGif_1.default.findAll({
        where: { source: 'manual' },
    });
    const inputKeywords = normalizedInput
        .split(/\s+/)
        .filter(w => w.length > 2 && w !== 'machine' && w !== 'equipment');
    let bestMatch = null;
    let maxScore = 0;
    for (const item of allManualItems) {
        let score = 0;
        const itemNames = [item.rawName.toLowerCase(), ...item.alternativeNames.map(a => a.toLowerCase())];
        // Check keyword overlap
        for (const kw of inputKeywords) {
            if (itemNames.some(n => n.includes(kw))) {
                score += 2; // Strong keyword match
            }
        }
        // Check muscle overlap
        const muscleOverlap = item.targetMuscles.filter(m => targetMuscles.some(tm => tm.toLowerCase() === m.toLowerCase()));
        score += muscleOverlap.length * 1.5;
        if (score > maxScore) {
            maxScore = score;
            bestMatch = item;
        }
    }
    // Threshold check: at least some relevance
    if (bestMatch && maxScore >= 2) {
        console.log(`[SmartMatch] Fuzzy hit for "${equipmentName}" -> "${bestMatch.rawName}" (Score: ${maxScore})`);
        return bestMatch.gifs;
    }
    // ── 3. Universal Fallback ──────────────────────────────────────────────────
    const fallback = await EquipmentGif_1.default.findOne({
        where: { equipmentKey: FALLBACK_KEY }
    });
    if (fallback && fallback.gifs.length > 0) {
        console.log(`[SmartMatch] Fallback used for "${equipmentName}"`);
        return fallback.gifs;
    }
    console.log(`[SmartMatch] No match found for "${equipmentName}"`);
    return [];
};
exports.getOrFetchEquipmentGifs = getOrFetchEquipmentGifs;
/**
 * Manually upserts GIFs for an equipment type using uploaded file buffers.
 */
const upsertManualGifsFromFiles = async ({ equipmentName, files, captions, targetMuscles = [], alternativeNames = [], }) => {
    const key = (0, exports.normalizeEquipmentKey)(equipmentName);
    const gifItems = [];
    for (let i = 0; i < files.length; i++) {
        const buffer = files[i];
        const caption = captions?.[i] ?? equipmentName;
        const finalUrl = await (0, exports.processAndUploadGif)(buffer);
        if (!finalUrl)
            continue;
        gifItems.push({ url: finalUrl, caption });
    }
    if (gifItems.length === 0)
        return [];
    await EquipmentGif_1.default.upsert({
        equipmentKey: key,
        rawName: equipmentName.trim(),
        targetMuscles: targetMuscles.map((m) => m.trim()),
        alternativeNames: alternativeNames.map((n) => n.trim().toLowerCase()),
        gifs: gifItems,
        source: 'manual',
    });
    return gifItems;
};
exports.upsertManualGifsFromFiles = upsertManualGifsFromFiles;
