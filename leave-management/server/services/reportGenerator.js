const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { getDatabase } = require('../database/connection');
const { generateVerificationCode, generateFileHash } = require('./verificationService');

// Korean font path (Windows)
const KOREAN_FONT_PATH = 'C:/Windows/Fonts/malgun.ttf';
const KOREAN_FONT_BOLD_PATH = 'C:/Windows/Fonts/malgunbd.ttf';
const hasKoreanFont = fs.existsSync(KOREAN_FONT_PATH);

/**
 * Query leave usage records for a date range
 */
function queryUsageData(dateFrom, dateTo, departmentId) {
  const db = getDatabase();
  let sql = `
    SELECT
      lr.id,
      e.employee_number,
      e.name AS employee_name,
      d.name AS department_name,
      lt.name AS leave_type_name,
      lr.start_date,
      lr.end_date,
      lr.total_days,
      lr.status,
      lr.created_at
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    JOIN departments d ON d.id = e.department_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.start_date <= ? AND lr.end_date >= ?
      AND lr.status IN ('approved', 'pending')
  `;
  const params = [dateTo, dateFrom];

  if (departmentId) {
    sql += ' AND e.department_id = ?';
    params.push(departmentId);
  }

  sql += ' ORDER BY lr.start_date DESC, e.name';
  return db.prepare(sql).all(...params);
}

/**
 * Query summary data aggregated by employee
 */
function queryUsageSummary(dateFrom, dateTo, departmentId) {
  const db = getDatabase();
  let sql = `
    SELECT
      e.employee_number,
      e.name AS employee_name,
      d.name AS department_name,
      lt.name AS leave_type_name,
      SUM(lr.total_days) AS total_used
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    JOIN departments d ON d.id = e.department_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.start_date <= ? AND lr.end_date >= ?
      AND lr.status = 'approved'
  `;
  const params = [dateTo, dateFrom];

  if (departmentId) {
    sql += ' AND e.department_id = ?';
    params.push(departmentId);
  }

  sql += ' GROUP BY e.id, lt.id ORDER BY d.name, e.name, lt.name';
  return db.prepare(sql).all(...params);
}

/**
 * Query summary report data (yearly, by department)
 */
function querySummaryReportData(year, departmentId) {
  const db = getDatabase();
  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;

  // Department summary
  let deptSql = `
    SELECT
      d.name AS department_name,
      lt.name AS leave_type_name,
      COUNT(lr.id) AS request_count,
      SUM(lr.total_days) AS total_days
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    JOIN departments d ON d.id = e.department_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.start_date >= ? AND lr.end_date <= ?
      AND lr.status = 'approved'
  `;
  const params = [dateFrom, dateTo];

  if (departmentId) {
    deptSql += ' AND e.department_id = ?';
    params.push(departmentId);
  }

  deptSql += ' GROUP BY d.id, lt.id ORDER BY d.name, lt.name';
  const byDepartment = db.prepare(deptSql).all(...params);

  // Balance summary
  let balSql = `
    SELECT
      e.employee_number,
      e.name AS employee_name,
      d.name AS department_name,
      lb.total_days,
      lb.used_days,
      lb.adjusted_days,
      (lb.total_days + lb.adjusted_days - lb.used_days) AS remaining_days
    FROM leave_balances lb
    JOIN employees e ON e.id = lb.employee_id
    JOIN departments d ON d.id = e.department_id
    WHERE lb.year = ?
  `;
  const balParams = [year];

  if (departmentId) {
    balSql += ' AND e.department_id = ?';
    balParams.push(departmentId);
  }

  balSql += ' ORDER BY d.name, e.name';
  const balances = db.prepare(balSql).all(...balParams);

  return { byDepartment, balances };
}

const STATUS_LABELS = {
  draft: '임시저장',
  pending: '결재중',
  approved: '승인',
  rejected: '반려',
  recalled: '회수',
  cancelled: '취소'
};

/**
 * Create styled Excel header row
 */
function styleHeaderRow(worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: 'FF212529' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F5F7' }
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFDDE1E7' } }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  headerRow.height = 28;
}

/**
 * Generate Usage Report
 */
async function generateUsageReport({ dateFrom, dateTo, departmentId, format = 'zip', generatedBy = '' }) {
  const records = queryUsageData(dateFrom, dateTo, departmentId);
  const summary = queryUsageSummary(dateFrom, dateTo, departmentId);

  // Build verification code input data
  const codeInput = `usage|${dateFrom}|${dateTo}|${departmentId || 'all'}|${Date.now()}`;
  const verificationCode = generateVerificationCode(codeInput);

  if (format === 'excel') {
    const buffer = await buildUsageExcel(records, summary, dateFrom, dateTo, verificationCode);
    const fileHash = generateFileHash(buffer);
    return {
      buffer,
      filename: `휴가사용현황_${dateFrom}_${dateTo}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      verificationCode,
      fileHash
    };
  }

  if (format === 'pdf') {
    const buffer = await buildUsagePdf(records, summary, dateFrom, dateTo, verificationCode, generatedBy);
    const fileHash = generateFileHash(buffer);
    return {
      buffer,
      filename: `휴가사용현황_${dateFrom}_${dateTo}.pdf`,
      contentType: 'application/pdf',
      verificationCode,
      fileHash
    };
  }

  // ZIP (default)
  const excelBuf = await buildUsageExcel(records, summary, dateFrom, dateTo, verificationCode);
  const pdfBuf = await buildUsagePdf(records, summary, dateFrom, dateTo, verificationCode, generatedBy);
  const zipBuf = await buildZip([
    { name: `휴가사용현황_${dateFrom}_${dateTo}.xlsx`, buffer: excelBuf },
    { name: `휴가사용현황_${dateFrom}_${dateTo}.pdf`, buffer: pdfBuf }
  ]);
  const fileHash = generateFileHash(zipBuf);
  return {
    buffer: zipBuf,
    filename: `휴가사용현황_${dateFrom}_${dateTo}.zip`,
    contentType: 'application/zip',
    verificationCode,
    fileHash
  };
}

/**
 * Generate Summary Report
 */
async function generateSummaryReport({ year, departmentId, format = 'zip', generatedBy = '' }) {
  const { byDepartment, balances } = querySummaryReportData(year, departmentId);

  const codeInput = `summary|${year}|${departmentId || 'all'}|${Date.now()}`;
  const verificationCode = generateVerificationCode(codeInput);

  if (format === 'excel') {
    const buffer = await buildSummaryExcel(byDepartment, balances, year, verificationCode);
    const fileHash = generateFileHash(buffer);
    return {
      buffer,
      filename: `휴가요약보고서_${year}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      verificationCode,
      fileHash
    };
  }

  if (format === 'pdf') {
    const buffer = await buildSummaryPdf(byDepartment, balances, year, verificationCode, generatedBy);
    const fileHash = generateFileHash(buffer);
    return {
      buffer,
      filename: `휴가요약보고서_${year}.pdf`,
      contentType: 'application/pdf',
      verificationCode,
      fileHash
    };
  }

  // ZIP
  const excelBuf = await buildSummaryExcel(byDepartment, balances, year, verificationCode);
  const pdfBuf = await buildSummaryPdf(byDepartment, balances, year, verificationCode, generatedBy);
  const zipBuf = await buildZip([
    { name: `휴가요약보고서_${year}.xlsx`, buffer: excelBuf },
    { name: `휴가요약보고서_${year}.pdf`, buffer: pdfBuf }
  ]);
  const fileHash = generateFileHash(zipBuf);
  return {
    buffer: zipBuf,
    filename: `휴가요약보고서_${year}.zip`,
    contentType: 'application/zip',
    verificationCode,
    fileHash
  };
}

// ──────────── Excel Builders ────────────

async function buildUsageExcel(records, summary, dateFrom, dateTo, verificationCode) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '휴가관리 시스템';
  workbook.created = new Date();

  // Sheet 1: Individual records
  const ws1 = workbook.addWorksheet('사용 현황');
  ws1.columns = [
    { header: '사번', key: 'employee_number', width: 12 },
    { header: '이름', key: 'employee_name', width: 12 },
    { header: '부서', key: 'department_name', width: 16 },
    { header: '유형', key: 'leave_type_name', width: 14 },
    { header: '시작일', key: 'start_date', width: 14 },
    { header: '종료일', key: 'end_date', width: 14 },
    { header: '일수', key: 'total_days', width: 8 },
    { header: '상태', key: 'status', width: 10 },
  ];
  styleHeaderRow(ws1);

  records.forEach((r) => {
    ws1.addRow({
      ...r,
      status: STATUS_LABELS[r.status] || r.status
    });
  });

  // Sheet 2: Summary by employee
  const ws2 = workbook.addWorksheet('직원별 요약');
  ws2.columns = [
    { header: '사번', key: 'employee_number', width: 12 },
    { header: '이름', key: 'employee_name', width: 12 },
    { header: '부서', key: 'department_name', width: 16 },
    { header: '유형', key: 'leave_type_name', width: 14 },
    { header: '사용일수', key: 'total_used', width: 10 },
  ];
  styleHeaderRow(ws2);

  summary.forEach((r) => ws2.addRow(r));

  // Verification info sheet
  const ws3 = workbook.addWorksheet('검증 정보');
  ws3.addRow(['검증코드', verificationCode]);
  ws3.addRow(['기간', `${dateFrom} ~ ${dateTo}`]);
  ws3.addRow(['생성일시', new Date().toLocaleString('ko-KR')]);
  ws3.addRow(['건수', records.length]);
  ws3.getColumn(1).width = 16;
  ws3.getColumn(2).width = 40;

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function buildSummaryExcel(byDepartment, balances, year, verificationCode) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '휴가관리 시스템';
  workbook.created = new Date();

  // Sheet 1: Department summary
  const ws1 = workbook.addWorksheet('부서별 요약');
  ws1.columns = [
    { header: '부서', key: 'department_name', width: 16 },
    { header: '유형', key: 'leave_type_name', width: 14 },
    { header: '건수', key: 'request_count', width: 8 },
    { header: '총 일수', key: 'total_days', width: 10 },
  ];
  styleHeaderRow(ws1);
  byDepartment.forEach((r) => ws1.addRow(r));

  // Sheet 2: Balance summary
  const ws2 = workbook.addWorksheet('잔여일수 현황');
  ws2.columns = [
    { header: '사번', key: 'employee_number', width: 12 },
    { header: '이름', key: 'employee_name', width: 12 },
    { header: '부서', key: 'department_name', width: 16 },
    { header: '총 일수', key: 'total_days', width: 10 },
    { header: '사용일수', key: 'used_days', width: 10 },
    { header: '조정일수', key: 'adjusted_days', width: 10 },
    { header: '잔여일수', key: 'remaining_days', width: 10 },
  ];
  styleHeaderRow(ws2);
  balances.forEach((r) => ws2.addRow(r));

  // Verification info
  const ws3 = workbook.addWorksheet('검증 정보');
  ws3.addRow(['검증코드', verificationCode]);
  ws3.addRow(['연도', year]);
  ws3.addRow(['생성일시', new Date().toLocaleString('ko-KR')]);
  ws3.getColumn(1).width = 16;
  ws3.getColumn(2).width = 40;

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ──────────── PDF Builders ────────────

function registerFont(doc) {
  if (hasKoreanFont) {
    doc.registerFont('Korean', KOREAN_FONT_PATH);
    if (fs.existsSync(KOREAN_FONT_BOLD_PATH)) {
      doc.registerFont('KoreanBold', KOREAN_FONT_BOLD_PATH);
    }
    return 'Korean';
  }
  return 'Helvetica';
}

function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

async function buildUsagePdf(records, summary, dateFrom, dateTo, verificationCode, generatedBy) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const bufPromise = pdfToBuffer(doc);
  const fontName = registerFont(doc);

  // Title
  doc.font(fontName).fontSize(18).text('휴가 사용 현황 보고서', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#6B7280')
    .text(`기간: ${dateFrom} ~ ${dateTo}    |    생성자: ${generatedBy}    |    생성일: ${new Date().toLocaleString('ko-KR')}`, { align: 'center' });
  doc.moveDown(1);

  // Table header
  doc.fillColor('#212529');
  const colWidths = [50, 50, 70, 60, 70, 70, 40, 50];
  const headers = ['사번', '이름', '부서', '유형', '시작일', '종료일', '일수', '상태'];
  const startX = 40;
  let y = doc.y;

  // Header background
  doc.save();
  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 20).fill('#F3F5F7');
  doc.restore();
  doc.fillColor('#212529');

  let x = startX;
  doc.fontSize(8).font(fontName);
  headers.forEach((h, i) => {
    doc.text(h, x + 2, y + 5, { width: colWidths[i] - 4, align: 'center' });
    x += colWidths[i];
  });

  y += 22;

  // Table rows
  const maxRows = Math.min(records.length, 40); // limit rows per page
  for (let ri = 0; ri < records.length; ri++) {
    if (y > 750) {
      doc.addPage();
      y = 40;
    }
    const r = records[ri];
    x = startX;
    const rowData = [
      r.employee_number, r.employee_name, r.department_name,
      r.leave_type_name, r.start_date, r.end_date,
      String(r.total_days), STATUS_LABELS[r.status] || r.status
    ];
    rowData.forEach((val, i) => {
      doc.fontSize(7).text(val || '', x + 2, y + 3, { width: colWidths[i] - 4, align: 'center' });
      x += colWidths[i];
    });
    y += 16;
  }

  // Verification section on last page
  doc.addPage();
  doc.fontSize(14).font(fontName).text('검증 정보', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(10);
  doc.text(`검증코드: ${verificationCode}`);
  doc.text(`기간: ${dateFrom} ~ ${dateTo}`);
  doc.text(`생성자: ${generatedBy}`);
  doc.text(`생성일시: ${new Date().toLocaleString('ko-KR')}`);
  doc.text(`총 건수: ${records.length}건`);
  doc.text(`총 사용일수: ${records.reduce((sum, r) => sum + r.total_days, 0)}일`);

  doc.end();
  return bufPromise;
}

async function buildSummaryPdf(byDepartment, balances, year, verificationCode, generatedBy) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const bufPromise = pdfToBuffer(doc);
  const fontName = registerFont(doc);

  // Title
  doc.font(fontName).fontSize(18).text('휴가 요약 보고서', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#6B7280')
    .text(`연도: ${year}    |    생성자: ${generatedBy}    |    생성일: ${new Date().toLocaleString('ko-KR')}`, { align: 'center' });
  doc.moveDown(1);

  // Department summary table
  doc.fillColor('#212529').fontSize(12).text('부서별 휴가 사용 요약');
  doc.moveDown(0.5);

  const colWidths1 = [120, 100, 80, 80];
  const headers1 = ['부서', '유형', '건수', '총 일수'];
  let y = doc.y;
  let x = 40;

  doc.save();
  doc.rect(40, y, colWidths1.reduce((a, b) => a + b, 0), 20).fill('#F3F5F7');
  doc.restore();
  doc.fillColor('#212529').fontSize(8);

  headers1.forEach((h, i) => {
    doc.text(h, x + 2, y + 5, { width: colWidths1[i] - 4, align: 'center' });
    x += colWidths1[i];
  });
  y += 22;

  byDepartment.forEach((r) => {
    if (y > 750) { doc.addPage(); y = 40; }
    x = 40;
    const rowData = [r.department_name, r.leave_type_name, String(r.request_count), String(r.total_days)];
    rowData.forEach((val, i) => {
      doc.fontSize(7).text(val || '', x + 2, y + 3, { width: colWidths1[i] - 4, align: 'center' });
      x += colWidths1[i];
    });
    y += 16;
  });

  // Balance summary
  doc.addPage();
  doc.fillColor('#212529').fontSize(12).font(fontName).text('직원별 잔여일수 현황');
  doc.moveDown(0.5);

  const colWidths2 = [50, 50, 80, 50, 50, 50, 50];
  const headers2 = ['사번', '이름', '부서', '총일수', '사용', '조정', '잔여'];
  y = doc.y;
  x = 40;

  doc.save();
  doc.rect(40, y, colWidths2.reduce((a, b) => a + b, 0), 20).fill('#F3F5F7');
  doc.restore();
  doc.fillColor('#212529').fontSize(8);

  headers2.forEach((h, i) => {
    doc.text(h, x + 2, y + 5, { width: colWidths2[i] - 4, align: 'center' });
    x += colWidths2[i];
  });
  y += 22;

  balances.forEach((r) => {
    if (y > 750) { doc.addPage(); y = 40; }
    x = 40;
    const rowData = [
      r.employee_number, r.employee_name, r.department_name,
      String(r.total_days), String(r.used_days), String(r.adjusted_days), String(r.remaining_days)
    ];
    rowData.forEach((val, i) => {
      doc.fontSize(7).text(val || '', x + 2, y + 3, { width: colWidths2[i] - 4, align: 'center' });
      x += colWidths2[i];
    });
    y += 16;
  });

  // Verification section
  doc.addPage();
  doc.fontSize(14).font(fontName).text('검증 정보', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(10);
  doc.text(`검증코드: ${verificationCode}`);
  doc.text(`연도: ${year}`);
  doc.text(`생성자: ${generatedBy}`);
  doc.text(`생성일시: ${new Date().toLocaleString('ko-KR')}`);

  doc.end();
  return bufPromise;
}

// ──────────── ZIP Builder ────────────

async function buildZip(files) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    files.forEach(({ name, buffer }) => {
      archive.append(buffer, { name });
    });

    archive.finalize();
  });
}

module.exports = {
  generateUsageReport,
  generateSummaryReport
};
