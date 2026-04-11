"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeImage = void 0;
const sharp_1 = __importDefault(require("sharp"));
/**
 * Optimizes an image buffer by resizing and converting to WebP.
 * WebP provides the best balance between quality and file size.
 *
 * @param buffer Input image buffer (Buffer or Uint8Array).
 * @param maxWidth Optional maximum width (default 1200px).
 * @returns Object containing optimized buffer, mimeType, and extension.
 */
const optimizeImage = async (buffer, maxWidth = 1200) => {
    const image = (0, sharp_1.default)(buffer);
    const metadata = await image.metadata();
    let pipeline = image;
    // Resize only if the image is wider than the specified maxWidth
    if (metadata.width && metadata.width > maxWidth) {
        pipeline = pipeline.resize(maxWidth, null, {
            withoutEnlargement: true,
            fit: "inside",
        });
    }
    // Convert to WebP format with 80% quality
    // 'effort' 4 is a good balance between speed and compression
    const optimizedBuffer = await pipeline
        .webp({
        quality: 80,
        effort: 4,
    })
        .toBuffer();
    return {
        buffer: optimizedBuffer,
        mimeType: "image/webp",
        extension: "webp",
    };
};
exports.optimizeImage = optimizeImage;
