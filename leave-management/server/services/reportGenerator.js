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

const STATUS_LABELS = {
  draft: '임시저장',
  pending: '결재중',
  approved: '승인',
  rejected: '반려',
  recalled: '회수',
  cancelled: '취소'
};

const STEP_TYPE_LABELS = {
  draft: '기안',
  cooperation: '협조',
  review: '검토',
  approval: '결재'
};

// ════════════════════════════════════════════════
//  DATA QUERY FUNCTIONS
// ════════════════════════════════════════════════

/**
 * Section 1: 총괄 요약 — 직원별 연차 현황
 */
function queryOverviewSummary(year, departmentId) {
  const db = getDatabase();
  let sql = `
    SELECT
      e.employee_number,
      e.name AS employee_name,
      d.name AS department_name,
      e.hire_date,
      lb.total_days,
      lb.used_days,
      lb.adjusted_days,
      (lb.total_days - lb.used_days + lb.adjusted_days) AS remaining_days
    FROM leave_balances lb
    JOIN employees e ON e.id = lb.employee_id
    JOIN departments d ON d.id = e.department_id
    WHERE lb.year = ? AND e.status = 'active'
  `;
  const params = [year];
  if (departmentId) {
    sql += ' AND e.department_id = ?';
    params.push(departmentId);
  }
  sql += ' ORDER BY d.name, e.name';
  return db.prepare(sql).all(...params);
}

/**
 * Section 2: 사용 상세 — 결재완료일 + 최종승인자 포함
 */
function queryUsageDetail(dateFrom, dateTo, departmentId) {
  const db = getDatabase();
  let sql = `
    SELECT
      lr.id AS request_id,
      e.employee_number,
      e.name AS employee_name,
      d.name AS department_name,
      lt.name AS leave_type_name,
      lr.start_date,
      lr.end_date,
      lr.total_days,
      lr.status,
      lr.is_urgent,
      lr.is_retroactive,
      (
        SELECT acts.acted_at
        FROM approval_steps acts
        WHERE acts.request_id = lr.id AND acts.step_type = 'approval' AND acts.status = 'approved'
        ORDER BY acts.step_order DESC LIMIT 1
      ) AS approval_completed_at,
      (
        SELECT ae.name
        FROM approval_steps acts2
        JOIN employees ae ON ae.id = COALESCE(acts2.acted_by, acts2.assigned_to)
        WHERE acts2.request_id = lr.id AND acts2.step_type = 'approval' AND acts2.status = 'approved'
        ORDER BY acts2.step_order DESC LIMIT 1
      ) AS final_approver_name,
      (
        SELECT acts3.is_delegated
        FROM approval_steps acts3
        WHERE acts3.request_id = lr.id AND acts3.step_type = 'approval' AND acts3.status = 'approved'
        ORDER BY acts3.step_order DESC LIMIT 1
      ) AS final_is_delegated
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
 * Section 3: 결재 이력 상세 — 건별 결재 단계
 */
function queryApprovalDetails(dateFrom, dateTo, departmentId) {
  const db = getDatabase();

  // 먼저 대상 신청 건 조회
  let reqSql = `
    SELECT
      lr.id AS request_id,
      e.name AS employee_name,
      e.employee_number,
      lt.name AS leave_type_name,
      lr.start_date,
      lr.end_date,
      lr.total_days,
      lr.status
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    JOIN departments d ON d.id = e.department_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.start_date <= ? AND lr.end_date >= ?
      AND lr.status IN ('approved', 'pending', 'rejected')
  `;
  const params = [dateTo, dateFrom];
  if (departmentId) {
    reqSql += ' AND e.department_id = ?';
    params.push(departmentId);
  }
  reqSql += ' ORDER BY lr.start_date DESC';
  const requests = db.prepare(reqSql).all(...params);

  // 각 건별 결재 단계 조회
  const stepStmt = db.prepare(`
    SELECT
      ast.step_order,
      ast.step_type,
      ae.name AS assigned_name,
      ast.read_at,
      ast.acted_at,
      ast.status,
      ast.is_delegated,
      oe.name AS original_assignee_name
    FROM approval_steps ast
    JOIN employees ae ON ae.id = COALESCE(ast.acted_by, ast.assigned_to)
    LEFT JOIN employees oe ON oe.id = ast.assigned_to AND ast.is_delegated = 1 AND ast.acted_by IS NOT NULL AND ast.acted_by != ast.assigned_to
    WHERE ast.request_id = ?
    ORDER BY ast.step_order ASC
  `);

  return requests.map(req => ({
    ...req,
    steps: stepStmt.all(req.request_id)
  }));
}

/**
 * Section 4: 수동 조정 이력
 */
function queryAdjustmentHistory(dateFrom, dateTo) {
  const db = getDatabase();
  const adjustments = db.prepare(`
    SELECT
      ba.id,
      ba.amount,
      ba.reason,
      ba.created_at,
      te.employee_number AS target_number,
      te.name AS target_name,
      ae.employee_number AS adjuster_number,
      ae.name AS adjuster_name,
      lb.total_days,
      lb.used_days,
      lb.adjusted_days
    FROM balance_adjustments ba
    JOIN leave_balances lb ON lb.id = ba.balance_id
    JOIN employees te ON te.id = lb.employee_id
    JOIN employees ae ON ae.id = ba.adjusted_by
    WHERE ba.created_at >= ? AND ba.created_at <= ?
    ORDER BY ba.created_at DESC
  `).all(dateFrom + ' 00:00:00', dateTo + ' 23:59:59');

  // 경고 분석
  const warnings = [];

  // 1) 보고서 생성일 기준 7일 이내에 5건 이상
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM balance_adjustments
    WHERE DATE(created_at) >= ?
  `).get(sevenDaysAgo);
  if (recentCount && recentCount.cnt >= 5) {
    warnings.push(`보고 직전 대량 조정 감지: ${recentCount.cnt}건 (최근 7일)`);
  }

  // 2) 동일 직원 3회 이상 반복 조정
  const repeatRows = db.prepare(`
    SELECT te.name, COUNT(*) AS cnt
    FROM balance_adjustments ba
    JOIN leave_balances lb ON lb.id = ba.balance_id
    JOIN employees te ON te.id = lb.employee_id
    WHERE ba.created_at >= ? AND ba.created_at <= ?
    GROUP BY lb.employee_id HAVING cnt >= 3
  `).all(dateFrom + ' 00:00:00', dateTo + ' 23:59:59');
  for (const r of repeatRows) {
    warnings.push(`반복 조정 대상: ${r.name} (${r.cnt}회)`);
  }

  // 3) 사유 불명확
  const vagueCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM balance_adjustments ba
    WHERE ba.created_at >= ? AND ba.created_at <= ?
      AND (ba.reason LIKE '%기타%' OR ba.reason LIKE '%조정%' OR ba.reason LIKE '%수정%' OR LENGTH(ba.reason) <= 2)
  `).get(dateFrom + ' 00:00:00', dateTo + ' 23:59:59');
  if (vagueCount && vagueCount.cnt > 0) {
    warnings.push(`사유 불명확: ${vagueCount.cnt}건`);
  }

  return { adjustments, warnings };
}

/**
 * 통계 요약 수치 계산
 */
function calcStats(overviewData, usageData) {
  return {
    totalEmployees: overviewData.length,
    totalRequests: usageData.length,
    totalUsedDays: usageData.reduce((s, r) => s + r.total_days, 0)
  };
}

/**
 * 근속연수 계산
 */
function calcYearsOfService(hireDate) {
  if (!hireDate) return 0;
  const hire = new Date(hireDate);
  const now = new Date();
  let years = now.getFullYear() - hire.getFullYear();
  const mDiff = now.getMonth() - hire.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < hire.getDate())) years--;
  return Math.max(0, years);
}

// ════════════════════════════════════════════════
//  MAIN ENTRY: generateUsageReport (5-Section)
// ════════════════════════════════════════════════

async function generateUsageReport({ dateFrom, dateTo, departmentId, format = 'zip', generatedBy = '' }) {
  const year = new Date(dateFrom).getFullYear();

  // 5개 섹션 데이터 수집
  const overviewData = queryOverviewSummary(year, departmentId);
  const usageData = queryUsageDetail(dateFrom, dateTo, departmentId);
  const approvalData = queryApprovalDetails(dateFrom, dateTo, departmentId);
  const { adjustments: adjustmentData, warnings: adjustmentWarnings } = queryAdjustmentHistory(dateFrom, dateTo);
  const stats = calcStats(overviewData, usageData);

  // 검증코드: 5개 섹션 모든 데이터 포함
  const allDataStr = JSON.stringify({ overviewData, usageData, approvalData, adjustmentData });
  const codeInput = `usage|${dateFrom}|${dateTo}|${departmentId || 'all'}|${Date.now()}|${allDataStr}`;
  const verificationCode = generateVerificationCode(codeInput);

  const reportCtx = {
    dateFrom, dateTo, year, generatedBy, verificationCode, stats,
    overviewData, usageData, approvalData, adjustmentData, adjustmentWarnings
  };

  if (format === 'excel') {
    const buffer = await buildExcel(reportCtx);
    const fileHash = generateFileHash(buffer);
    return { buffer, filename: `휴가사용현황_${dateFrom}_${dateTo}.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', verificationCode, fileHash };
  }
  if (format === 'pdf') {
    const buffer = await buildPdf(reportCtx);
    const fileHash = generateFileHash(buffer);
    return { buffer, filename: `휴가사용현황_${dateFrom}_${dateTo}.pdf`, contentType: 'application/pdf', verificationCode, fileHash };
  }
  // ZIP
  const excelBuf = await buildExcel(reportCtx);
  const pdfBuf = await buildPdf(reportCtx);
  const zipBuf = await buildZip([
    { name: `휴가사용현황_${dateFrom}_${dateTo}.xlsx`, buffer: excelBuf },
    { name: `휴가사용현황_${dateFrom}_${dateTo}.pdf`, buffer: pdfBuf }
  ]);
  const fileHash = generateFileHash(zipBuf);
  return { buffer: zipBuf, filename: `휴가사용현황_${dateFrom}_${dateTo}.zip`, contentType: 'application/zip', verificationCode, fileHash };
}

/**
 * Summary Report — 기존 호환 (간소화 버전)
 */
async function generateSummaryReport({ year, departmentId, format = 'zip', generatedBy = '' }) {
  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;
  return generateUsageReport({ dateFrom, dateTo, departmentId, format, generatedBy });
}

// ════════════════════════════════════════════════
//  EXCEL BUILDER (5 Sheets)
// ════════════════════════════════════════════════

function applyHeaderStyle(ws) {
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF212529' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F5F7' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDE1E7' } } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  headerRow.height = 28;
}

async function buildExcel(ctx) {
  const { dateFrom, dateTo, year, generatedBy, verificationCode, stats,
    overviewData, usageData, approvalData, adjustmentData, adjustmentWarnings } = ctx;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '휴가관리 시스템';
  workbook.created = new Date();

  // ── Sheet 1: 총괄 요약 ──
  const ws1 = workbook.addWorksheet('총괄 요약');
  ws1.columns = [
    { header: '사번', key: 'employee_number', width: 12 },
    { header: '이름', key: 'employee_name', width: 12 },
    { header: '부서', key: 'department_name', width: 16 },
    { header: '입사일', key: 'hire_date', width: 12 },
    { header: '근속연수', key: 'years_of_service', width: 10 },
    { header: '발생일수', key: 'total_days', width: 10 },
    { header: '사용일수', key: 'used_days', width: 10 },
    { header: '조정일수', key: 'adjusted_days', width: 10 },
    { header: '잔여일수', key: 'remaining_days', width: 10 },
    { header: '소진율(%)', key: 'usage_rate', width: 10 },
  ];
  applyHeaderStyle(ws1);

  let sumTotal = 0, sumUsed = 0, sumAdj = 0, sumRemain = 0;
  overviewData.forEach((r) => {
    const yos = calcYearsOfService(r.hire_date);
    const rate = r.total_days > 0 ? ((r.used_days / r.total_days) * 100).toFixed(1) : '0.0';
    const row = ws1.addRow({
      ...r,
      years_of_service: yos,
      usage_rate: parseFloat(rate),
    });
    sumTotal += r.total_days; sumUsed += r.used_days;
    sumAdj += r.adjusted_days; sumRemain += r.remaining_days;
    if (r.remaining_days < 0) {
      row.eachCell((cell) => { cell.font = { ...cell.font, color: { argb: 'FFDC2626' } }; });
    }
    if (r.adjusted_days !== 0) {
      const adjCell = row.getCell('adjusted_days');
      adjCell.font = { ...adjCell.font, bold: true };
    }
  });
  const totRow = ws1.addRow({
    employee_number: '', employee_name: '합계', department_name: '', hire_date: '', years_of_service: '',
    total_days: sumTotal, used_days: sumUsed, adjusted_days: sumAdj, remaining_days: sumRemain,
    usage_rate: sumTotal > 0 ? parseFloat(((sumUsed / sumTotal) * 100).toFixed(1)) : 0,
  });
  totRow.eachCell((cell) => { cell.font = { ...cell.font, bold: true }; });

  // ── Sheet 2: 사용 상세 ──
  const ws2 = workbook.addWorksheet('사용 상세');
  ws2.columns = [
    { header: '사번', key: 'employee_number', width: 12 },
    { header: '이름', key: 'employee_name', width: 12 },
    { header: '부서', key: 'department_name', width: 16 },
    { header: '유형', key: 'leave_type_display', width: 18 },
    { header: '시작일', key: 'start_date', width: 12 },
    { header: '종료일', key: 'end_date', width: 12 },
    { header: '일수', key: 'total_days', width: 8 },
    { header: '상태', key: 'status_label', width: 10 },
    { header: '결재완료일', key: 'approval_completed_at', width: 18 },
    { header: '최종승인자', key: 'final_approver', width: 14 },
  ];
  applyHeaderStyle(ws2);

  usageData.forEach((r) => {
    let typeDisplay = r.leave_type_name;
    if (r.is_retroactive) typeDisplay += ' [사후]';
    if (r.is_urgent) typeDisplay += ' [긴급]';

    let approverDisplay = r.final_approver_name || '';
    if (r.final_is_delegated) approverDisplay += ' (대결)';

    const row = ws2.addRow({
      employee_number: r.employee_number,
      employee_name: r.employee_name,
      department_name: r.department_name,
      leave_type_display: typeDisplay,
      start_date: r.start_date,
      end_date: r.end_date,
      total_days: r.total_days,
      status_label: STATUS_LABELS[r.status] || r.status,
      approval_completed_at: r.status === 'pending' ? '결재중' : (r.approval_completed_at || ''),
      final_approver: approverDisplay,
    });
    if (r.status === 'pending') {
      row.getCell('approval_completed_at').font = { color: { argb: 'FFDC2626' } };
    }
  });

  // ── Sheet 3: 결재 이력 ──
  const ws3 = workbook.addWorksheet('결재 이력');
  ws3.columns = [
    { header: '신청번호', key: 'col1', width: 10 },
    { header: '신청자', key: 'col2', width: 12 },
    { header: '유형', key: 'col3', width: 14 },
    { header: '기간', key: 'col4', width: 22 },
    { header: '일수', key: 'col5', width: 8 },
    { header: '단계', key: 'col6', width: 8 },
    { header: '결재유형', key: 'col7', width: 10 },
    { header: '결재자', key: 'col8', width: 12 },
    { header: '열람시각', key: 'col9', width: 18 },
    { header: '결재시각', key: 'col10', width: 18 },
    { header: '결과', key: 'col11', width: 8 },
    { header: '대결여부', key: 'col12', width: 16 },
  ];
  applyHeaderStyle(ws3);

  let totalSteps = 0, delegateCount = 0, instantCount = 0;
  approvalData.forEach((req) => {
    // 건 헤더 행
    const hRow = ws3.addRow({
      col1: `#${req.request_id}`, col2: req.employee_name,
      col3: req.leave_type_name,
      col4: `${req.start_date} ~ ${req.end_date}`,
      col5: req.total_days,
      col6: '', col7: '', col8: '', col9: '', col10: '', col11: '', col12: ''
    });
    hRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1F5' } };
      cell.font = { bold: true, size: 10 };
    });

    req.steps.forEach((s) => {
      totalSteps++;
      if (s.is_delegated) delegateCount++;
      let isInstant = false;
      if (s.read_at && s.acted_at) {
        const diff = (new Date(s.acted_at) - new Date(s.read_at)) / 1000;
        if (diff <= 60) { isInstant = true; instantCount++; }
      }

      let delegateStr = '';
      if (s.is_delegated) {
        delegateStr = s.original_assignee_name ? `대결 (원래: ${s.original_assignee_name})` : '대결';
      }

      ws3.addRow({
        col1: '', col2: '', col3: '', col4: '', col5: '',
        col6: s.step_order,
        col7: STEP_TYPE_LABELS[s.step_type] || s.step_type,
        col8: s.assigned_name,
        col9: s.read_at || '',
        col10: (s.acted_at || '') + (isInstant ? ' *' : ''),
        col11: s.status === 'approved' ? '승인' : (s.status === 'rejected' ? '반려' : '대기'),
        col12: delegateStr,
      });
    });
  });

  // 결재 이력 통계 행
  ws3.addRow({});
  ws3.addRow({ col1: `대결 처리: ${delegateCount}건 / 전체 ${totalSteps}건 (${totalSteps > 0 ? ((delegateCount / totalSteps) * 100).toFixed(1) : 0}%)` });
  ws3.addRow({ col1: `즉시 처리(1분 이내): ${instantCount}건 / 전체 ${totalSteps}건 (${totalSteps > 0 ? ((instantCount / totalSteps) * 100).toFixed(1) : 0}%)` });

  // ── Sheet 4: 조정 이력 ──
  const ws4 = workbook.addWorksheet('조정 이력');
  ws4.columns = [
    { header: '조정일시', key: 'created_at', width: 18 },
    { header: '대상직원', key: 'target', width: 18 },
    { header: '조정자', key: 'adjuster', width: 18 },
    { header: '조정 전', key: 'before_val', width: 10 },
    { header: '조정량', key: 'amount_str', width: 10 },
    { header: '조정 후', key: 'after_val', width: 10 },
    { header: '사유', key: 'reason', width: 30 },
  ];
  applyHeaderStyle(ws4);

  if (adjustmentData.length === 0) {
    ws4.addRow({ created_at: '해당 기간 내 수동 조정 내역이 없습니다.' });
  } else {
    adjustmentData.forEach((a) => {
      const beforeVal = (a.total_days - a.used_days + a.adjusted_days) - a.amount;
      const afterVal = beforeVal + a.amount;
      ws4.addRow({
        created_at: a.created_at,
        target: `${a.target_number} ${a.target_name}`,
        adjuster: `${a.adjuster_number} ${a.adjuster_name}`,
        before_val: beforeVal,
        amount_str: a.amount > 0 ? `+${a.amount}` : String(a.amount),
        after_val: afterVal,
        reason: a.reason,
      });
    });
    if (adjustmentWarnings.length > 0) {
      ws4.addRow({});
      adjustmentWarnings.forEach(w => {
        const wRow = ws4.addRow({ created_at: w });
        wRow.getCell(1).font = { color: { argb: 'FFDC2626' }, bold: true };
      });
    }
  }

  // ── Sheet 5: 검증 정보 ──
  const ws5 = workbook.addWorksheet('검증 정보');
  ws5.getColumn(1).width = 20;
  ws5.getColumn(2).width = 50;
  ws5.addRow(['생성일시', new Date().toLocaleString('ko-KR')]);
  ws5.addRow(['생성자', generatedBy]);
  ws5.addRow(['데이터 기간', `${dateFrom} ~ ${dateTo}`]);
  ws5.addRow(['총 직원 수', `${stats.totalEmployees}명`]);
  ws5.addRow(['총 사용 건수', `${stats.totalRequests}건`]);
  ws5.addRow(['총 사용 일수', `${stats.totalUsedDays}일`]);
  ws5.addRow(['총 조정 건수', `${adjustmentData.length}건`]);
  ws5.addRow(['검증코드', verificationCode]);

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ════════════════════════════════════════════════
//  PDF BUILDER (5 Sections)
// ════════════════════════════════════════════════

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

// PDF 색상 상수
const C = {
  navy: '#1B3A5C',
  headerBg: '#F3F5F7',
  headerText: '#8A95A3',
  body: '#333333',
  danger: '#DC2626',
  primary: '#1B5E9E',
  line: '#EEF0F2',
  groupBg: '#EEF1F5',
};

// 페이지 하단 번호 추가
function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.fontSize(8).fillColor('#8A95A3')
      .text(`- ${i + 1} -`, 0, 810, { align: 'center', width: 595 });
    doc.restore();
  }
}

// 테이블 헤더 그리기 유틸
function drawTableHeader(doc, fontName, headers, colWidths, startX, y) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  doc.save();
  doc.rect(startX, y, totalW, 20).fill(C.headerBg);
  doc.restore();
  doc.fillColor(C.headerText).fontSize(7).font(fontName);
  let x = startX;
  headers.forEach((h, i) => {
    doc.text(h, x + 2, y + 6, { width: colWidths[i] - 4, align: 'center' });
    x += colWidths[i];
  });
  return y + 22;
}

// 테이블 행 그리기 유틸
function drawTableRow(doc, fontName, values, colWidths, startX, y, options = {}) {
  const { colors = [], bolds = [], rowBg } = options;
  if (rowBg) {
    const totalW = colWidths.reduce((a, b) => a + b, 0);
    doc.save();
    doc.rect(startX, y, totalW, 16).fill(rowBg);
    doc.restore();
  }
  let x = startX;
  values.forEach((val, i) => {
    doc.fillColor(colors[i] || C.body)
      .fontSize(7)
      .font(bolds[i] ? (hasKoreanFont ? 'KoreanBold' : fontName) : fontName)
      .text(String(val ?? ''), x + 2, y + 4, { width: colWidths[i] - 4, align: 'center' });
    x += colWidths[i];
  });
  // 구분선
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  doc.save();
  doc.moveTo(startX, y + 15).lineTo(startX + totalW, y + 15).lineWidth(0.5).strokeColor(C.line).stroke();
  doc.restore();
  return y + 16;
}

// 페이지 오버플로 체크
function checkPage(doc, y, needed = 40) {
  if (y > 780 - needed) {
    doc.addPage();
    return 40;
  }
  return y;
}

async function buildPdf(ctx) {
  const { dateFrom, dateTo, year, generatedBy, verificationCode, stats,
    overviewData, usageData, approvalData, adjustmentData, adjustmentWarnings } = ctx;

  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const bufPromise = pdfToBuffer(doc);
  const fontName = registerFont(doc);
  const boldFont = hasKoreanFont ? 'KoreanBold' : fontName;
  const SX = 40; // startX
  const PW = 515; // page width (595 - 40*2)

  // ════════════════════════════════════════
  //  섹션 1: 표지 + 총괄 요약
  // ════════════════════════════════════════

  // 표지
  doc.moveDown(6);
  doc.font(boldFont).fontSize(24).fillColor(C.navy)
    .text('휴가 사용 현황 보고서', { align: 'center' });
  doc.moveDown(0.8);
  doc.font(fontName).fontSize(14).fillColor(C.headerText)
    .text('재단법인 경상남도사회서비스원', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(C.body)
    .text(`${dateFrom} ~ ${dateTo}`, { align: 'center' });
  doc.moveDown(1.5);
  doc.fontSize(10).fillColor(C.headerText)
    .text(`생성자: ${generatedBy}  |  생성일: ${new Date().toLocaleString('ko-KR')}`, { align: 'center' });

  // 요약 수치 박스
  doc.moveDown(3);
  const boxY = doc.y;
  const boxW = 150;
  const boxGap = (PW - boxW * 3) / 2;
  const summaryItems = [
    { label: '총 직원 수', value: `${stats.totalEmployees}명` },
    { label: '총 사용 건수', value: `${stats.totalRequests}건` },
    { label: '총 사용 일수', value: `${stats.totalUsedDays}일` },
  ];
  summaryItems.forEach((item, i) => {
    const bx = SX + i * (boxW + boxGap);
    doc.save();
    doc.roundedRect(bx, boxY, boxW, 60, 4).fill('#F9FAFB');
    doc.restore();
    doc.fillColor(C.headerText).fontSize(9).font(fontName)
      .text(item.label, bx, boxY + 12, { width: boxW, align: 'center' });
    doc.fillColor(C.navy).fontSize(18).font(boldFont)
      .text(item.value, bx, boxY + 30, { width: boxW, align: 'center' });
  });

  // 총괄 요약 테이블 (새 페이지)
  doc.addPage();
  doc.font(boldFont).fontSize(13).fillColor(C.navy).text('총괄 요약 — 직원별 연차 현황');
  doc.moveDown(0.5);

  const oc = [45, 40, 60, 60, 40, 45, 45, 45, 45, 45]; // 10 cols = 515 (not exact, but close)
  const oHeaders = ['사번', '이름', '부서', '입사일', '근속', '발생', '사용', '조정', '잔여', '소진율'];
  let y = drawTableHeader(doc, fontName, oHeaders, oc, SX, doc.y);

  let sumT = 0, sumU = 0, sumA = 0, sumR = 0;
  for (const r of overviewData) {
    y = checkPage(doc, y);
    const yos = calcYearsOfService(r.hire_date);
    const rate = r.total_days > 0 ? ((r.used_days / r.total_days) * 100).toFixed(1) : '0.0';
    const remaining = r.remaining_days;
    const adjStr = r.adjusted_days > 0 ? `+${r.adjusted_days}` : String(r.adjusted_days);
    sumT += r.total_days; sumU += r.used_days; sumA += r.adjusted_days; sumR += remaining;

    const colors = new Array(10).fill(C.body);
    const bolds = new Array(10).fill(false);
    if (remaining < 0) colors.fill(C.danger);
    if (r.adjusted_days !== 0) { bolds[7] = true; }

    y = drawTableRow(doc, fontName,
      [r.employee_number, r.employee_name, r.department_name, r.hire_date, `${yos}년`,
        r.total_days, r.used_days, adjStr, remaining, `${rate}%`],
      oc, SX, y, { colors, bolds });
  }

  // 합계 행
  y = checkPage(doc, y);
  const totRate = sumT > 0 ? ((sumU / sumT) * 100).toFixed(1) : '0.0';
  y = drawTableRow(doc, fontName,
    ['', '합계', '', '', '', sumT, sumU, sumA, sumR, `${totRate}%`],
    oc, SX, y, { bolds: [false, true, false, false, false, true, true, true, true, true] });

  // ════════════════════════════════════════
  //  섹션 2: 사용 상세
  // ════════════════════════════════════════

  doc.addPage();
  doc.font(boldFont).fontSize(13).fillColor(C.navy).text('휴가 사용 상세 내역');
  doc.moveDown(0.5);

  const uc = [40, 36, 52, 62, 52, 52, 30, 36, 72, 58]; // ~490 fit
  const uHeaders = ['사번', '이름', '부서', '유형', '시작일', '종료일', '일수', '상태', '결재완료일', '최종승인자'];
  y = drawTableHeader(doc, fontName, uHeaders, uc, SX, doc.y);

  for (const r of usageData) {
    y = checkPage(doc, y);

    let typeStr = r.leave_type_name;
    if (r.is_retroactive) typeStr += '[사후]';
    if (r.is_urgent) typeStr += '[긴급]';

    let approverStr = r.final_approver_name || '';
    if (r.final_is_delegated) approverStr += '(대결)';

    const completedStr = r.status === 'pending' ? '결재중' : (r.approval_completed_at || '');

    const colors = new Array(10).fill(C.body);
    if (r.status === 'pending') colors[8] = C.danger;

    y = drawTableRow(doc, fontName,
      [r.employee_number, r.employee_name, r.department_name, typeStr,
        r.start_date, r.end_date, r.total_days,
        STATUS_LABELS[r.status] || r.status, completedStr, approverStr],
      uc, SX, y, { colors });
  }

  // ════════════════════════════════════════
  //  섹션 3: 결재 이력 상세
  // ════════════════════════════════════════

  doc.addPage();
  doc.font(boldFont).fontSize(13).fillColor(C.navy).text('결재 이력 상세');
  doc.moveDown(0.5);

  let totalSteps = 0, delegateCount = 0, instantCount = 0;
  y = doc.y;

  for (const req of approvalData) {
    y = checkPage(doc, y, 60);

    // 건 헤더
    const totalW = 515;
    doc.save();
    doc.rect(SX, y, totalW, 18).fill(C.groupBg);
    doc.restore();
    doc.fillColor(C.navy).fontSize(8).font(boldFont)
      .text(`#${req.request_id}  ${req.employee_name}(${req.employee_number})  |  ${req.leave_type_name}  |  ${req.start_date} ~ ${req.end_date}  |  ${req.total_days}일`, SX + 4, y + 5, { width: totalW - 8 });
    y += 20;

    // 단계 테이블 헤더
    const sc = [40, 55, 60, 90, 90, 40, 100]; // ~475
    const sHeaders = ['단계', '유형', '결재자', '열람시각', '결재시각', '결과', '대결여부'];
    y = drawTableHeader(doc, fontName, sHeaders, sc, SX + 20, y);

    for (const s of req.steps) {
      y = checkPage(doc, y);
      totalSteps++;
      if (s.is_delegated) delegateCount++;

      let isInstant = false;
      if (s.read_at && s.acted_at) {
        const diff = (new Date(s.acted_at) - new Date(s.read_at)) / 1000;
        if (diff <= 60) { isInstant = true; instantCount++; }
      }

      let delegateStr = '';
      if (s.is_delegated) {
        delegateStr = s.original_assignee_name ? `대결 (원래: ${s.original_assignee_name})` : '대결';
      }
      const actedStr = (s.acted_at || '') + (isInstant ? ' *' : '');
      const resultStr = s.status === 'approved' ? '승인' : (s.status === 'rejected' ? '반려' : '대기');

      const colors = new Array(7).fill(C.body);
      if (isInstant) colors[4] = C.danger;

      y = drawTableRow(doc, fontName,
        [s.step_order, STEP_TYPE_LABELS[s.step_type] || s.step_type, s.assigned_name,
          s.read_at || '', actedStr, resultStr, delegateStr],
        sc, SX + 20, y, { colors });
    }
    y += 6;
  }

  // 결재 통계
  y = checkPage(doc, y, 40);
  doc.moveDown(0.5);
  y = doc.y;
  doc.save();
  doc.roundedRect(SX, y, PW, 40, 4).fill('#F9FAFB');
  doc.restore();
  doc.fillColor(C.body).fontSize(9).font(fontName);
  doc.text(`대결 처리: ${delegateCount}건 / 전체 ${totalSteps}건 (${totalSteps > 0 ? ((delegateCount / totalSteps) * 100).toFixed(1) : 0}%)`, SX + 10, y + 8);
  doc.text(`즉시 처리(1분 이내): ${instantCount}건 / 전체 ${totalSteps}건 (${totalSteps > 0 ? ((instantCount / totalSteps) * 100).toFixed(1) : 0}%)     * 열람~결재 1분 이내 건은 형식적 결재 의심`, SX + 10, y + 22);

  // ════════════════════════════════════════
  //  섹션 4: 수동 조정 이력
  // ════════════════════════════════════════

  doc.addPage();
  doc.font(boldFont).fontSize(13).fillColor(C.navy).text('수동 조정 이력');
  doc.moveDown(0.5);

  if (adjustmentData.length === 0) {
    doc.font(fontName).fontSize(10).fillColor(C.headerText)
      .text('해당 기간 내 수동 조정 내역이 없습니다.', { align: 'center' });
  } else {
    const ac = [80, 80, 80, 50, 50, 50, 125];
    const aHeaders = ['조정일시', '대상직원', '조정자', '조정 전', '조정량', '조정 후', '사유'];
    y = drawTableHeader(doc, fontName, aHeaders, ac, SX, doc.y);

    for (const a of adjustmentData) {
      y = checkPage(doc, y);
      const beforeVal = (a.total_days - a.used_days + a.adjusted_days) - a.amount;
      const afterVal = beforeVal + a.amount;
      const amtStr = a.amount > 0 ? `+${a.amount}` : String(a.amount);

      y = drawTableRow(doc, fontName,
        [a.created_at, `${a.target_number} ${a.target_name}`, `${a.adjuster_number} ${a.adjuster_name}`,
          beforeVal, amtStr, afterVal, a.reason],
        ac, SX, y);
    }

    // 경고 표시
    if (adjustmentWarnings.length > 0) {
      y = checkPage(doc, y, 20 + adjustmentWarnings.length * 16);
      y += 10;
      doc.save();
      doc.roundedRect(SX, y, PW, 12 + adjustmentWarnings.length * 16, 4).fill('#FEF2F2');
      doc.restore();
      y += 6;
      for (const w of adjustmentWarnings) {
        doc.fillColor(C.danger).fontSize(9).font(boldFont)
          .text(`\u26A0 ${w}`, SX + 10, y);
        y += 16;
      }
    }
  }

  // ════════════════════════════════════════
  //  섹션 5: 검증 정보
  // ════════════════════════════════════════

  doc.addPage();
  doc.moveDown(4);
  doc.font(boldFont).fontSize(16).fillColor(C.navy)
    .text('검증 정보', { align: 'center' });
  doc.moveDown(2);

  // 검증 정보 테이블
  const infoItems = [
    ['생성일시', new Date().toLocaleString('ko-KR')],
    ['생성자', generatedBy],
    ['데이터 기간', `${dateFrom} ~ ${dateTo}`],
    ['총 직원 수', `${stats.totalEmployees}명`],
    ['총 사용 건수', `${stats.totalRequests}건`],
    ['총 사용 일수', `${stats.totalUsedDays}일`],
    ['총 조정 건수', `${adjustmentData.length}건`],
  ];

  y = doc.y;
  const infoLW = 120;
  const infoVW = 300;
  const infoX = (595 - infoLW - infoVW) / 2;
  for (const [label, value] of infoItems) {
    doc.save();
    doc.rect(infoX, y, infoLW, 22).fill('#F3F5F7');
    doc.restore();
    doc.save();
    doc.rect(infoX + infoLW, y, infoVW, 22).fill('#FFFFFF');
    doc.restore();
    doc.save();
    doc.rect(infoX, y, infoLW + infoVW, 22).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.restore();
    doc.fillColor(C.headerText).fontSize(9).font(fontName)
      .text(label, infoX + 8, y + 6);
    doc.fillColor(C.body).fontSize(9).font(fontName)
      .text(value, infoX + infoLW + 8, y + 6);
    y += 22;
  }

  // 검증코드 강조
  y += 10;
  doc.save();
  doc.roundedRect(infoX, y, infoLW + infoVW, 36, 4).fill('#EFF6FF');
  doc.restore();
  doc.fillColor(C.headerText).fontSize(9).font(fontName)
    .text('검증코드', infoX + 8, y + 6);
  doc.fillColor(C.primary).fontSize(14).font(boldFont)
    .text(verificationCode, infoX + infoLW + 8, y + 8);
  y += 46;

  // 검증 방법 안내
  y += 16;
  doc.save();
  doc.roundedRect(infoX, y, infoLW + infoVW, 58, 4).lineWidth(0.5).strokeColor(C.line).stroke();
  doc.restore();
  doc.fillColor(C.navy).fontSize(9).font(boldFont)
    .text('검증 방법 안내', infoX + 10, y + 8);
  doc.fillColor(C.body).fontSize(8).font(fontName)
    .text('시설 방문 시 재단담당자 계정으로 로그인하여', infoX + 10, y + 24)
    .text('데이터 검증 → 보고서 검증 메뉴에서 위 검증코드를 입력하면', infoX + 10, y + 36)
    .text('원본 여부를 확인할 수 있습니다.', infoX + 10, y + 48);

  // 페이지 번호 추가
  addPageNumbers(doc);

  doc.end();
  return bufPromise;
}

// ════════════════════════════════════════════════
//  ZIP BUILDER
// ════════════════════════════════════════════════

async function buildZip(files) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    files.forEach(({ name, buffer }) => archive.append(buffer, { name }));
    archive.finalize();
  });
}

module.exports = {
  generateUsageReport,
  generateSummaryReport
};
