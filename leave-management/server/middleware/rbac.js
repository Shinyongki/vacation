/**
 * 역할 기반 접근 제어 미들웨어
 * 사용법: router.get('/path', authenticateToken, requireRole('hr_admin', 'director'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: '접근 권한이 없습니다.'
      });
    }

    next();
  };
}

module.exports = { requireRole };
