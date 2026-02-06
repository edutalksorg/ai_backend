const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Verifies a password against an ASP.NET Identity V3 hash.
 * Format: 0x01 | prf (4 bytes) | iterCount (4 bytes) | saltSize (4 bytes) | salt | subkey
 */
function verifyAspNetIdentityV3Hash(password, hashBase64) {
    try {
        const hashBytes = Buffer.from(hashBase64, 'base64');
        if (hashBytes.length < 13) return false;
        if (hashBytes[0] !== 0x01) return false;

        const prf = hashBytes.readUInt32BE(1);
        const iterCount = hashBytes.readUInt32BE(5);
        const saltSize = hashBytes.readUInt32BE(9);

        if (hashBytes.length < 13 + saltSize) return false;

        const salt = hashBytes.slice(13, 13 + saltSize);
        const savedSubkey = hashBytes.slice(13 + saltSize);

        let algorithm;
        switch (prf) {
            case 0: algorithm = 'sha1'; break;
            case 1: algorithm = 'sha256'; break;
            case 2: algorithm = 'sha512'; break;
            default: return false;
        }

        const generatedSubkey = crypto.pbkdf2Sync(
            password,
            salt,
            iterCount,
            savedSubkey.length,
            algorithm
        );

        return crypto.timingSafeEqual(savedSubkey, generatedSubkey);
    } catch (e) {
        console.error('Error verifying legacy hash:', e);
        return false;
    }
}

/**
 * Universal password verifier
 */
async function verifyPassword(password, hashedOrPlain) {
    if (!hashedOrPlain) return false;
    const cleanHash = hashedOrPlain.trim();

    // 1. Check if it's a Bcrypt hash
    if (cleanHash.startsWith('$2b$') || cleanHash.startsWith('$2a$')) {
        return await bcrypt.compare(password, cleanHash);
    }

    // 2. Check if it's an ASP.NET Identity V3 hash
    // Standard V3 length is 84, but we'll check prefixes to be sure
    if (cleanHash.startsWith('AQAA')) {
        return verifyAspNetIdentityV3Hash(password, cleanHash);
    }

    // 3. Fallback to plain text (not recommended, but for debugging if needed)
    return password === hashedOrPlain;
}

/**
 * Generates a new Bcrypt hash
 */
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

module.exports = {
    verifyPassword,
    hashPassword
};
