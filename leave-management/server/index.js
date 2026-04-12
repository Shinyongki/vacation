const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { initializeDatabase, closeDatabase } = require('./database/connection');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// 미들웨어
// ============================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// DB 초기화
// ============================================================
initializeDatabase();

// ============================================================
// API 라우트 (9개 도메인, 58개 엔드포인트)
// ============================================================

// 인증 (5 API)
app.use('/api/auth', require('./routes/auth'));

// 잔여일수 (3 API)
app.use('/api/balances', require('./routes/balances'));

// 관리자 (22+ API)
app.use('/api/admin', require('./routes/admin'));

// 휴가 신청 (7 API)
app.use('/api/leaves', require('./routes/leaves'));

// 승인 관리 (5 API)
app.use('/api/approvals', require('./routes/approvals'));

// 대시보드 (5 API)
app.use('/api/dashboard', require('./routes/dashboard'));

// 알림 (3 API)
app.use('/api/notifications', require('./routes/notifications'));

// 보고서 (3 API)
app.use('/api/reports', require('./routes/reports'));

// 데이터 검증 (3 API)
app.use('/api/verification', require('./routes/verification'));

// 캘린더 (2 API)
app.use('/api/calendar', require('./routes/calendar'));

// ============================================================
// 헬스체크
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ============================================================
// 정적 파일 서빙 (프로덕션 + SEA)
// ============================================================
const distPath = path.join(__dirname, '..', 'dist');
const fs = require('fs');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA 폴백: /api 이외 모든 요청 → index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============================================================
// 에러 핸들러 (맨 마지막)
// ============================================================
app.use(errorHandler);

// ============================================================
// 서버 시작
// ============================================================
const server = app.listen(PORT, () => {
  // 로컬 IP 주소 찾기
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }

  console.log('');
  console.log('  ========================================');
  console.log('  휴가관리 시스템이 시작되었습니다');
  console.log('  ========================================');
  console.log(`  브라우저에서 접속: http://${localIP}:${PORT}`);
  console.log(`  로컬 접속:       http://localhost:${PORT}`);
  console.log('  ========================================');
  console.log('');

  // 스케줄러 시작
  try {
    const { startScheduler } = require('./services/scheduler');
    startScheduler();
    console.log('  [Scheduler] Cron jobs started');
  } catch (e) {
    console.error('  [Scheduler] Failed to start:', e.message);
  }
});

// ============================================================
// Graceful shutdown
// ============================================================
function shutdown() {
  console.log('\n  Shutting down...');
  try {
    const { stopScheduler } = require('./services/scheduler');
    stopScheduler();
  } catch (e) { /* ignore */ }
  closeDatabase();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
