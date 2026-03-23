const zlib = require('zlib');

function normalizeText(value) {
    return String(value || '').trim();
}

function isImageFile(fileName) {
    const ext = String(fileName || '').split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp'].includes(ext);
}

function isKmlFile(fileName) {
    return String(fileName || '').toLowerCase().endsWith('.kml');
}

function readUint16LE(buf, offset) {
    return buf[offset] | (buf[offset + 1] << 8);
}

function readUint32LE(buf, offset) {
    return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}

function findEndOfCentralDirectory(buf) {
    const signature = 0x06054B50;
    for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i -= 1) {
        if (readUint32LE(buf, i) === signature) return i;
    }
    return -1;
}

function readZipEntries(buffer) {
    if (!Buffer.isBuffer(buffer)) {
        buffer = Buffer.from(buffer);
    }

    const eocdOffset = findEndOfCentralDirectory(buffer);
    if (eocdOffset < 0) {
        throw new Error('Arquivo ZIP/KMZ invalido: End of Central Directory nao encontrado.');
    }

    const cdOffset = readUint32LE(buffer, eocdOffset + 16);
    const entryCount = readUint16LE(buffer, eocdOffset + 10);
    const entries = [];
    let pos = cdOffset;

    for (let i = 0; i < entryCount; i += 1) {
        if (pos + 46 > buffer.length) break;
        const sig = readUint32LE(buffer, pos);
        if (sig !== 0x02014B50) break;

        const compressionMethod = readUint16LE(buffer, pos + 10);
        const compressedSize = readUint32LE(buffer, pos + 20);
        const uncompressedSize = readUint32LE(buffer, pos + 24);
        const nameLen = readUint16LE(buffer, pos + 28);
        const extraLen = readUint16LE(buffer, pos + 30);
        const commentLen = readUint16LE(buffer, pos + 32);
        const localHeaderOffset = readUint32LE(buffer, pos + 42);
        const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLen);

        const isDirectory = name.endsWith('/');

        let data = Buffer.alloc(0);
        if (!isDirectory && localHeaderOffset + 30 <= buffer.length) {
            const localNameLen = readUint16LE(buffer, localHeaderOffset + 26);
            const localExtraLen = readUint16LE(buffer, localHeaderOffset + 28);
            const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;

            if (dataStart + compressedSize <= buffer.length) {
                const raw = buffer.subarray(dataStart, dataStart + compressedSize);

                if (compressionMethod === 0) {
                    data = Buffer.from(raw);
                } else if (compressionMethod === 8) {
                    try {
                        data = zlib.inflateRawSync(raw);
                    } catch (_err) {
                        data = Buffer.alloc(0);
                    }
                }
            }
        }

        entries.push({ name, data, isDirectory, compressedSize, uncompressedSize });
        pos += 46 + nameLen + extraLen + commentLen;
    }

    return entries;
}

function extractKmzContents(buffer) {
    const entries = readZipEntries(buffer);

    let kmlText = '';
    const imageEntries = [];

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        if (!kmlText && isKmlFile(entry.name)) {
            kmlText = entry.data.toString('utf8');
        } else if (isImageFile(entry.name)) {
            const parts = normalizeText(entry.name).split('/');
            const fileName = parts[parts.length - 1] || entry.name;

            imageEntries.push({
                name: fileName,
                data: entry.data,
                internalPath: normalizeText(entry.name),
            });
        }
    }

    return { kmlText, imageEntries };
}

module.exports = {
    extractKmzContents,
    isImageFile,
    isKmlFile,
    readZipEntries,
};
