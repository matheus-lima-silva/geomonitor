const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

let s3ClientInstance = null;

function normalizeText(value) {
    return String(value || '').trim();
}

function toBoolean(value, defaultValue = false) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return defaultValue;
    return ['true', '1', 'yes', 'on'].includes(normalized);
}

function getConfiguredMediaBackend() {
    return normalizeText(process.env.MEDIA_BACKEND || 'local').toLowerCase() || 'local';
}

function isTigrisBackend() {
    return getConfiguredMediaBackend() === 'tigris';
}

function isTigrisAsset(asset) {
    return normalizeText(asset?.sourceKind || asset?.storageBackend).toLowerCase() === 'tigris';
}

function getMediaStorageRoot() {
    return process.env.MEDIA_STORAGE_ROOT
        ? path.resolve(process.env.MEDIA_STORAGE_ROOT)
        : path.join(__dirname, '..', '.storage', 'media');
}

function sanitizeFileName(fileName) {
    const normalized = normalizeText(fileName).replace(/[^\w.\-]+/g, '_');
    return normalized || 'arquivo.bin';
}

function buildLocalContentPath(mediaId, fileName) {
    return path.join(getMediaStorageRoot(), normalizeText(mediaId), sanitizeFileName(fileName));
}

async function ensureLocalDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function writeLocalContent(mediaId, fileName, buffer) {
    const filePath = buildLocalContentPath(mediaId, fileName);
    await ensureLocalDir(path.dirname(filePath));
    await fs.writeFile(filePath, buffer);

    return {
        filePath,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        storedSizeBytes: buffer.byteLength,
        storedAt: new Date().toISOString(),
    };
}

async function removeLocalMedia(mediaId) {
    await fs.rm(path.join(getMediaStorageRoot(), normalizeText(mediaId)), { recursive: true, force: true });
}

function getPresignTtlSeconds() {
    const parsed = Number(process.env.MEDIA_PRESIGN_TTL_SECONDS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 900;
}

function getBucketName() {
    const bucketName = normalizeText(process.env.BUCKET_NAME || process.env.TIGRIS_BUCKET_NAME);
    if (!bucketName) {
        throw new Error('BUCKET_NAME nao configurado para MEDIA_BACKEND=tigris');
    }
    return bucketName;
}

function buildS3ClientConfig() {
    const accessKeyId = normalizeText(process.env.AWS_ACCESS_KEY_ID);
    const secretAccessKey = normalizeText(process.env.AWS_SECRET_ACCESS_KEY);
    const endpoint = normalizeText(process.env.AWS_ENDPOINT_URL_S3);

    if (!accessKeyId || !secretAccessKey || !endpoint) {
        throw new Error('Credenciais S3/Tigris incompletas para MEDIA_BACKEND=tigris');
    }

    return {
        region: normalizeText(process.env.AWS_REGION) || 'auto',
        endpoint,
        forcePathStyle: toBoolean(process.env.AWS_S3_FORCE_PATH_STYLE, true),
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    };
}

function getS3Client() {
    if (s3ClientInstance) return s3ClientInstance;
    s3ClientInstance = new S3Client(buildS3ClientConfig());
    return s3ClientInstance;
}

async function createSignedUploadUrl({ storageKey, contentType }) {
    const expiresIn = getPresignTtlSeconds();
    const command = new PutObjectCommand({
        Bucket: getBucketName(),
        Key: normalizeText(storageKey),
        ContentType: normalizeText(contentType) || 'application/octet-stream',
    });

    const href = await getSignedUrl(getS3Client(), command, { expiresIn });

    return {
        href,
        method: 'PUT',
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        headers: {
            'Content-Type': normalizeText(contentType) || 'application/octet-stream',
        },
    };
}

async function createSignedAccessUrl({ storageKey }) {
    const expiresIn = getPresignTtlSeconds();
    const command = new GetObjectCommand({
        Bucket: getBucketName(),
        Key: normalizeText(storageKey),
    });

    const href = await getSignedUrl(getS3Client(), command, { expiresIn });
    return {
        href,
        method: 'GET',
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
}

async function deleteTigrisObject(storageKey) {
    if (!normalizeText(storageKey)) return;

    await getS3Client().send(new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: normalizeText(storageKey),
    }));
}

async function removeStoredMedia(asset) {
    if (!asset || typeof asset !== 'object') return;

    if (isTigrisAsset(asset)) {
        await deleteTigrisObject(asset.storageKey);
        return;
    }

    await removeLocalMedia(asset.id);
}

function resetS3Client() {
    s3ClientInstance = null;
}

module.exports = {
    buildLocalContentPath,
    buildS3ClientConfig,
    createSignedAccessUrl,
    createSignedUploadUrl,
    getBucketName,
    getConfiguredMediaBackend,
    getMediaStorageRoot,
    getPresignTtlSeconds,
    isTigrisAsset,
    isTigrisBackend,
    removeStoredMedia,
    resetS3Client,
    sanitizeFileName,
    writeLocalContent,
};
