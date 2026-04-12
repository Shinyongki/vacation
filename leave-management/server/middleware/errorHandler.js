/**
 * 전역 에러 핸들러
 */
function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: '잘못된 요청 형식입니다.'
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      success: false,
      error: '데이터 제약 조건 위반입니다.'
    });
  }

  if (err.code === 'SQLITE_ERROR') {
    return res.status(500).json({
      success: false,
      error: '데이터베이스 오류가 발생했습니다.'
    });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500
    ? '서버 내부 오류가 발생했습니다.'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message
  });
}

module.exports = { errorHandler };
