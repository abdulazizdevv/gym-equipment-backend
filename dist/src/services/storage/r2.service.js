"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.uploadFile = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
/**
 * Cloudflare R2 Storage Service (S3-compatible)
 */
const getS3Client = () => {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) {
        console.warn("Cloudflare R2 credentials are missing. Storage service will fail.");
    }
    return new client_s3_1.S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: accessKeyId || "",
            secretAccessKey: secretAccessKey || "",
        },
    });
};
const s3Client = getS3Client();
/**
 * Uploads a file to Cloudflare R2 bucket.
 * @param file The file content as Buffer or Uint8Array.
 * @param fileName The name (key) to store the file as.
 * @param mimeType The content type of the file.
 * @returns The full public URL of the uploaded file.
 */
const uploadFile = async (file, fileName, mimeType) => {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName)
        throw new Error("R2_BUCKET_NAME is not defined in environment variables.");
    await s3Client.send(new client_s3_1.PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: file,
        ContentType: mimeType,
    }));
    const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    return `${publicUrl}/${fileName}`;
};
exports.uploadFile = uploadFile;
/**
 * Deletes a file from Cloudflare R2 bucket.
 * @param fileName The name (key) of the file to delete.
 */
const deleteFile = async (fileName) => {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName)
        return;
    try {
        await s3Client.send(new client_s3_1.DeleteObjectCommand({
            Bucket: bucketName,
            Key: fileName,
        }));
    }
    catch (error) {
        console.error(`Failed to delete file ${fileName} from R2:`, error);
    }
};
exports.deleteFile = deleteFile;
