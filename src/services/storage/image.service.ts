import sharp from "sharp"

/**
 * Optimizes an image buffer by resizing and converting to WebP.
 * WebP provides the best balance between quality and file size.
 *
 * @param buffer Input image buffer (Buffer or Uint8Array).
 * @param maxWidth Optional maximum width (default 1200px).
 * @returns Object containing optimized buffer, mimeType, and extension.
 */
export const optimizeImage = async (
  buffer: Buffer | Uint8Array,
  maxWidth = 1200,
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> => {
  const image = sharp(buffer)
  const metadata = await image.metadata()

  let pipeline = image

  // Resize only if the image is wider than the specified maxWidth
  if (metadata.width && metadata.width > maxWidth) {
    pipeline = pipeline.resize(maxWidth, null, {
      withoutEnlargement: true,
      fit: "inside",
    })
  }

  // Convert to WebP format with 80% quality
  // 'effort' 4 is a good balance between speed and compression
  const optimizedBuffer = await pipeline
    .webp({
      quality: 80,
      effort: 4,
    })
    .toBuffer()

  return {
    buffer: optimizedBuffer,
    mimeType: "image/webp",
    extension: "webp",
  }
}
