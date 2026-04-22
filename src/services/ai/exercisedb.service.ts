import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import { Op } from 'sequelize'
import { uploadFile } from '../storage/r2.service'
import EquipmentGif, { GifItem } from '../../models/EquipmentGif'

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_KEY = 'universal_fallback'

// ─── Equipment Key Normalization ──────────────────────────────────────────────

/**
 * Converts any equipment name into a stable lowercase DB key.
 * Special case: "Universal Fallback" -> "universal_fallback"
 */
export const normalizeEquipmentKey = (name: string): string => {
  const n = name.toLowerCase().trim()
  if (n === 'universal fallback' || n === 'universal_fallback') {
    return FALLBACK_KEY
  }
  return n
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

// ─── GIF Processing & Upload ──────────────────────────────────────────────────

/**
 * Processes a GIF (upscale, sharpen) and uploads it to Cloudflare R2.
 * Input can be a public URL or a raw Buffer.
 * Returns the public R2 URL, or null on failure.
 */
export const processAndUploadGif = async (
  input: string | Buffer,
): Promise<string | null> => {
  try {
    let inputBuffer: Buffer

    if (typeof input === 'string') {
      const response = await fetch(input)
      if (!response.ok) return null
      inputBuffer = Buffer.from(await response.arrayBuffer())
    } else {
      inputBuffer = input
    }

    let finalBuffer: Buffer | Uint8Array = inputBuffer
    let mimeType = 'image/gif'
    let extension = 'gif'

    try {
      const metadata = await sharp(inputBuffer).metadata()
      const isWebP = metadata.format === 'webp'

      // 🔥 UPSCALE & SHARPEN 🔥
      const pipeline = sharp(inputBuffer, { animated: true }).resize(720, 720, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .sharpen({
        sigma: 1,
        m1: 2,
        m2: 10,
      })

      if (isWebP) {
        finalBuffer = await pipeline.webp({ quality: 80 }).toBuffer()
        mimeType = 'image/webp'
        extension = 'webp'
      } else {
        finalBuffer = await pipeline.gif({ colors: 128 }).toBuffer()
        mimeType = 'image/gif'
        extension = 'gif'
      }
    } catch (sharpErr) {
      console.error(
        '[GIF Process] Sharp processing failed, falling back to original:',
        sharpErr,
      )
      finalBuffer = inputBuffer
    }

    const fileName = `equipment-gifs/${uuidv4()}.${extension}`
    return await uploadFile(new Uint8Array(finalBuffer), fileName, mimeType)
  } catch (err) {
    console.error('[GIF Process] process/upload failed:', err)
    return null
  }
}

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
export const getOrFetchEquipmentGifs = async (
  equipmentName: string,
  targetMuscles: string[] = [],
): Promise<GifItem[]> => {
  const key = normalizeEquipmentKey(equipmentName)
  const normalizedInput = equipmentName.toLowerCase().trim()

  // ── 1. Direct Match ────────────────────────────────────────────────────────
  const directMatch = await EquipmentGif.findOne({
    where: {
      [Op.or]: [
        { equipmentKey: key },
        { rawName: { [Op.iLike]: `%${normalizedInput}%` } },
        { alternativeNames: { [Op.contains]: [normalizedInput] } },
      ],
    },
  })

  if (directMatch && directMatch.gifs.length > 0) {
    console.log(`[SmartMatch] Direct hit for "${equipmentName}"`)
    return directMatch.gifs
  }

  // ── 2. Fuzzy Keyword & Muscle Matching ─────────────────────────────────────
  // Fetch all manual entries to do scoring (usually small number of machines)
  const allManualItems = await EquipmentGif.findAll({
    where: { source: 'manual' },
  })

  const inputKeywords = normalizedInput
    .split(/\s+/)
    .filter(w => w.length > 2 && w !== 'machine' && w !== 'equipment')

  let bestMatch: EquipmentGif | null = null
  let maxScore = 0

  for (const item of allManualItems) {
    let score = 0
    const itemNames = [item.rawName.toLowerCase(), ...item.alternativeNames.map(a => a.toLowerCase())]
    
    // Check keyword overlap
    for (const kw of inputKeywords) {
      if (itemNames.some(n => n.includes(kw))) {
        score += 2 // Strong keyword match
      }
    }

    // Check muscle overlap
    const muscleOverlap = item.targetMuscles.filter(m => 
      targetMuscles.some(tm => tm.toLowerCase() === m.toLowerCase())
    )
    score += muscleOverlap.length * 1.5

    if (score > maxScore) {
      maxScore = score
      bestMatch = item
    }
  }

  // Threshold check: at least some relevance
  if (bestMatch && maxScore >= 2) {
    console.log(`[SmartMatch] Fuzzy hit for "${equipmentName}" -> "${bestMatch.rawName}" (Score: ${maxScore})`)
    return bestMatch.gifs
  }

  // ── 3. Universal Fallback ──────────────────────────────────────────────────
  const fallback = await EquipmentGif.findOne({
    where: { equipmentKey: FALLBACK_KEY }
  })

  if (fallback && fallback.gifs.length > 0) {
    console.log(`[SmartMatch] Fallback used for "${equipmentName}"`)
    return fallback.gifs
  }

  console.log(`[SmartMatch] No match found for "${equipmentName}"`)
  return []
}

/**
 * Manually upserts GIFs for an equipment type using uploaded file buffers.
 */
export const upsertManualGifsFromFiles = async ({
  equipmentName,
  files,
  captions,
  targetMuscles = [],
  alternativeNames = [],
}: {
  equipmentName: string
  files: Buffer[]
  captions?: string[]
  targetMuscles?: string[]
  alternativeNames?: string[]
}): Promise<GifItem[]> => {
  const key = normalizeEquipmentKey(equipmentName)
  const gifItems: GifItem[] = []

  for (let i = 0; i < files.length; i++) {
    const buffer = files[i]
    const caption = captions?.[i] ?? equipmentName

    const finalUrl = await processAndUploadGif(buffer)
    if (!finalUrl) continue

    gifItems.push({ url: finalUrl, caption })
  }

  if (gifItems.length === 0) return []

  await EquipmentGif.upsert({
    equipmentKey: key,
    rawName: equipmentName.trim(),
    targetMuscles: targetMuscles.map((m) => m.trim()),
    alternativeNames: alternativeNames.map((n) => n.trim().toLowerCase()),
    gifs: gifItems,
    source: 'manual',
  })

  return gifItems
}
