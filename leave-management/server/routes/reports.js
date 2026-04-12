const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getDatabase } = require('../database/connection');
const { generateUsageReport, generateSummaryReport } = require('../services/reportGenerator');
const { generateFileHash } = require('../services/verificationService');

const ALLOWED_ROLES = ['director', 'hr_admin', 'foundation'];

/**
 * GET /api/reports/usage
 * Generate and download usage report
 */
router.get('/usage',
  authenticateToken,
  requireRole(...ALLOWED_ROLES),
  async (req, res) => {
    try {
      const { date_from, date_to, department_id, format = 'zip' } = req.query;

      if (!date_from || !date_to) {
        return res.status(400).json({
          success: false,
          error: '시작일과 종료일을 지정해 주세요.'
        });
      }

      if (!['excel', 'pdf', 'zip'].includes(format)) {
        return res.status(400).json({
          success: false,
          error: '지원하지 않는 형식입니다. (excel, pdf, zip)'
        });
      }

      const result = await generateUsageReport({
        dateFrom: date_from,
        dateTo: date_to,
        departmentId: department_id ? parseInt(department_id) : null,
        format,
        generatedBy: req.user.name
      });

      // Log to export_logs
      const db = getDatabase();
      db.prepare(`
        INSERT INTO export_logs (exported_by, export_type, date_from, date_to, verification_code, file_hash)
        VALUES (?, 'usage', ?, ?, ?, ?)
      `).run(req.user.id, date_from, date_to, result.verificationCode, result.fileHash);

      // Send file
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
      res.setHeader('X-Verification-Code', result.verificationCode);
      res.send(result.buffer);
    } catch (err) {
      console.error('Report generation error:', err);
      res.status(500).json({
        success: false,
        error: '보고서 생성 중 오류가 발생했습니다.'
      });
    }
  }
);

/**
 * GET /api/reports/summary
 * Generate and download summary report
 */
router.get('/summary',
  authenticateToken,
  requireRole(...ALLOWED_ROLES),
  async (req, res) => {
    try {
      const { year, department_id, format = 'zip' } = req.query;
      const reportYear = year ? parseInt(year) : new Date().getFullYear();

      if (!['excel', 'pdf', 'zip'].includes(format)) {
        return res.status(400).json({
          success: false,
          error: '지원하지 않는 형식입니다. (excel, pdf, zip)'
        });
      }

      const result = await generateSummaryReport({
        year: reportYear,
        departmentId: department_id ? parseInt(department_id) : null,
        format,
        generatedBy: req.user.name
      });

      // Log to export_logs
      const db = getDatabase();
      const dateFrom = `${reportYear}-01-01`;
      const dateTo = `${reportYear}-12-31`;
      db.prepare(`
        INSERT INTO export_logs (exported_by, export_type, date_from, date_to, verification_code, file_hash)
        VALUES (?, 'summary', ?, ?, ?, ?)
      `).run(req.user.id, dateFrom, dateTo, result.verificationCode, result.fileHash);

      // Send file
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
      res.setHeader('X-Verification-Code', result.verificationCode);
      res.send(result.buffer);
    } catch (err) {
      console.error('Summary report generation error:', err);
      res.status(500).json({
        success: false,
        error: '요약 보고서 생성 중 오류가 발생했습니다.'
      });
    }
  }
);

/**
 * GET /api/reports/export
 * Combined export: usage + summary → zip
 */
router.get('/export',
  authenticateToken,
  requireRole(...ALLOWED_ROLES),
  async (req, res) => {
    try {
      const { date_from, date_to, year, department_id } = req.query;

      const reportYear = year ? parseInt(year) : new Date().getFullYear();
      const dateFrom = date_from || `${reportYear}-01-01`;
      const dateTo = date_to || `${reportYear}-12-31`;

      // Generate both reports as zip
      const usageResult = await generateUsageReport({
        dateFrom,
        dateTo,
        departmentId: department_id ? parseInt(department_id) : null,
        format: 'zip',
        generatedBy: req.user.name
      });

      const summaryResult = await generateSummaryReport({
        year: reportYear,
        departmentId: department_id ? parseInt(department_id) : null,
        format: 'zip',
        generatedBy: req.user.name
      });

      // Combine into a single zip using archiver
      const archiver = require('archiver');
      const chunks = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      const bufPromise = new Promise((resolve, reject) => {
        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);
      });

      archive.append(usageResult.buffer, { name: usageResult.filename });
      archive.append(summaryResult.buffer, { name: summaryResult.filename });
      archive.finalize();

      const zipBuffer = await bufPromise;
      const { generateFileHash: genHash } = require('../services/verificationService');
      const fileHash = genHash(zipBuffer);

      // Log to export_logs (log as usage type for combined export)
      const db = getDatabase();
      db.prepare(`
        INSERT INTO export_logs (exported_by, export_type, date_from, date_to, verification_code, file_hash)
        VALUES (?, 'usage', ?, ?, ?, ?)
      `).run(req.user.id, dateFrom, dateTo, usageResult.verificationCode, fileHash);

      const filename = `휴가보고서_통합_${dateFrom}_${dateTo}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader('X-Verification-Code', usageResult.verificationCode);
      res.send(zipBuffer);
    } catch (err) {
      console.error('Combined export error:', err);
      res.status(500).json({
        success: false,
        error: '통합 보고서 생성 중 오류가 발생했습니다.'
      });
    }
  }
);

module.exports = router;
