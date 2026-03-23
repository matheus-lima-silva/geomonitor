function buildCrc32Table() {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let current = index;
        for (let bit = 0; bit < 8; bit += 1) {
            current = (current & 1) ? (0xEDB88320 ^ (current >>> 1)) : (current >>> 1);
        }
        table[index] = current >>> 0;
    }
    return table;
}

const CRC32_TABLE = buildCrc32Table();

function computeCrc32(buffer) {
    let crc = 0xFFFFFFFF;
    for (const value of buffer) {
        crc = CRC32_TABLE[(crc ^ value) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function toDosDateTime(value) {
    const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
    const year = Math.max(1980, date.getUTCFullYear());
    const dosTime = ((date.getUTCHours() & 0x1F) << 11)
        | ((date.getUTCMinutes() & 0x3F) << 5)
        | Math.floor(date.getUTCSeconds() / 2);
    const dosDate = (((year - 1980) & 0x7F) << 9)
        | (((date.getUTCMonth() + 1) & 0x0F) << 5)
        | (date.getUTCDate() & 0x1F);
    return { dosTime, dosDate };
}

function toBuffer(value) {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    return Buffer.from(String(value || ''), 'utf8');
}

function buildStoredZip(entries = []) {
    const normalizedEntries = (Array.isArray(entries) ? entries : [])
        .filter((entry) => entry && entry.name)
        .map((entry) => ({
            nameBuffer: Buffer.from(String(entry.name), 'utf8'),
            dataBuffer: toBuffer(entry.data),
            modifiedAt: entry.modifiedAt instanceof Date ? entry.modifiedAt : new Date(entry.modifiedAt || Date.now()),
        }));

    const localParts = [];
    const centralParts = [];
    let offset = 0;

    normalizedEntries.forEach((entry) => {
        const crc32 = computeCrc32(entry.dataBuffer);
        const { dosTime, dosDate } = toDosDateTime(entry.modifiedAt);
        const generalPurposeFlags = 0x0800;

        const localHeader = Buffer.alloc(30 + entry.nameBuffer.length);
        localHeader.writeUInt32LE(0x04034B50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(generalPurposeFlags, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(dosTime, 10);
        localHeader.writeUInt16LE(dosDate, 12);
        localHeader.writeUInt32LE(crc32, 14);
        localHeader.writeUInt32LE(entry.dataBuffer.length, 18);
        localHeader.writeUInt32LE(entry.dataBuffer.length, 22);
        localHeader.writeUInt16LE(entry.nameBuffer.length, 26);
        localHeader.writeUInt16LE(0, 28);
        entry.nameBuffer.copy(localHeader, 30);

        const centralHeader = Buffer.alloc(46 + entry.nameBuffer.length);
        centralHeader.writeUInt32LE(0x02014B50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(generalPurposeFlags, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(dosTime, 12);
        centralHeader.writeUInt16LE(dosDate, 14);
        centralHeader.writeUInt32LE(crc32, 16);
        centralHeader.writeUInt32LE(entry.dataBuffer.length, 20);
        centralHeader.writeUInt32LE(entry.dataBuffer.length, 24);
        centralHeader.writeUInt16LE(entry.nameBuffer.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);
        entry.nameBuffer.copy(centralHeader, 46);

        localParts.push(localHeader, entry.dataBuffer);
        centralParts.push(centralHeader);
        offset += localHeader.length + entry.dataBuffer.length;
    });

    const centralDirectory = Buffer.concat(centralParts);
    const endOfCentralDirectory = Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(0x06054B50, 0);
    endOfCentralDirectory.writeUInt16LE(0, 4);
    endOfCentralDirectory.writeUInt16LE(0, 6);
    endOfCentralDirectory.writeUInt16LE(normalizedEntries.length, 8);
    endOfCentralDirectory.writeUInt16LE(normalizedEntries.length, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
    endOfCentralDirectory.writeUInt32LE(offset, 16);
    endOfCentralDirectory.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

module.exports = {
    buildStoredZip,
};
