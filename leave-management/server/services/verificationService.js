const crypto = require('crypto');
const { getDatabase } = require('../database/connection');

const FALLBACK_SECRET = 'leave-mgmt-2026';

/**
 * Get system secret from system_settings or use fallback
 */
function getSystemSecret() {
  try {
    const db = getDatabase();
    const row = db.prepare(
      "SELECT value FROM system_settings WHERE key = 'verification_secret'"
    ).get();
    return row ? row.value : FALLBACK_SECRET;
  } catch {
    return FALLBACK_SECRET;
  }
}

/**
 * Generate a 16-character verification code with hyphens: XXXX-XXXX-XXXX-XXXX
 * @param {string} data - Input data string
 * @returns {string} Formatted verification code
 */
function generateVerificationCode(data) {
  const secret = getSystemSecret();
  const hash = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
    .toUpperCase();

  // Take first 16 hex characters and format with hyphens
  const code = hash.substring(0, 16);
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
}

/**
 * Generate SHA-256 hash of file buffer
 * @param {Buffer} buffer - File content buffer
 * @returns {string} Hex hash string
 */
function generateFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Verify an export by its verification code
 * @param {string} verificationCode - The XXXX-XXXX-XXXX-XXXX code
 * @returns {{ verified: boolean, exportLog?: object }}
 */
function verifyExport(verificationCode) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT el.*, e.name AS exported_by_name, e.employee_number
    FROM export_logs el
    JOIN employees e ON e.id = el.exported_by
    WHERE el.verification_code = ?
  `).get(verificationCode);

  if (!row) {
    return { verified: false };
  }

  return {
    verified: true,
    exportLog: {
      id: row.id,
      exportedBy: row.exported_by_name,
      exportedByNumber: row.employee_number,
      exportType: row.export_type,
      dateFrom: row.date_from,
      dateTo: row.date_to,
      fileHash: row.file_hash,
      verificationCode: row.verification_code,
      createdAt: row.created_at
    }
  };
}

module.exports = {
  generateVerificationCode,
  generateFileHash,
  verifyExport
};
