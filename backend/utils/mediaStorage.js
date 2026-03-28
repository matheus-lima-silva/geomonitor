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

async function streamToBuffer(stream) {
    if (!stream) return Buffer.alloc(0);
    if (Buffer.isBuffer(stream)) return stream;
    if (stream instanceof Uint8Array) return Buffer.from(stream);
    if (typeof stream.transformToByteArray === 'function') {
        return Buffer.from(await stream.transformToByteArray());
    }
    if (typeof stream.arrayBuffer === 'function') {
        return Buffer.from(await stream.arrayBuffer());
    }

    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
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

async function writeStoredContent(asset, buffer) {
    if (!asset || typeof asset !== 'object') {
        throw new Error('Media invalida para gravacao.');
    }

    const contentBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
    const sha256 = crypto.createHash('sha256').update(contentBuffer).digest('hex');

    if (isTigrisAsset(asset)) {
        const storageKey = normalizeText(asset.storageKey);
        if (!storageKey) {
            throw new Error('storageKey nao configurado para media Tigris.');
        }

        const response = await getS3Client().send(new PutObjectCommand({
            Bucket: getBucketName(),
            Key: storageKey,
            Body: contentBuffer,
            ContentType: normalizeText(asset.contentType) || 'application/octet-stream',
        }));

        return {
            storedAt: new Date().toISOString(),
            storedSizeBytes: contentBuffer.byteLength,
            sha256,
            etag: normalizeText(response?.ETag).replace(/^\"|\"$/g, ''),
            filePath: '',
        };
    }

    const localResult = await writeLocalContent(asset.id, asset.fileName, contentBuffer);
    return {
        ...localResult,
        sha256: localResult.sha256 || sha256,
    };
}

async function deleteTigrisObject(storageKey) {
    if (!normalizeText(storageKey)) return;

    await getS3Client().send(new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: normalizeText(storageKey),
    }));
}

async function readStoredMediaContent(asset) {
    if (!asset || typeof asset !== 'object') {
        throw new Error('Media invalida para leitura.');
    }

    if (isTigrisAsset(asset)) {
        const response = await getS3Client().send(new GetObjectCommand({
            Bucket: getBucketName(),
            Key: normalizeText(asset.storageKey),
        }));

        return {
            buffer: await streamToBuffer(response.Body),
            contentType: normalizeText(asset.contentType) || 'application/octet-stream',
            fileName: sanitizeFileName(asset.fileName || asset.id || 'arquivo.bin'),
        };
    }

    const filePath = normalizeText(asset.filePath);
    if (!filePath) {
        throw new Error('Conteudo local da media ainda nao disponivel.');
    }

    return {
        buffer: await fs.readFile(filePath),
        contentType: normalizeText(asset.contentType) || 'application/octet-stream',
        fileName: sanitizeFileName(asset.fileName || asset.id || path.basename(filePath) || 'arquivo.bin'),
    };
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
    readStoredMediaContent,
    removeStoredMedia,
    resetS3Client,
    sanitizeFileName,
    writeStoredContent,
    writeLocalContent,
};
