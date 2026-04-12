const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'leave-management-jwt-secret-key-2026';
const JWT_EXPIRES_IN = '8h';

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: '인증 토큰이 필요합니다.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      employeeNumber: decoded.employeeNumber,
      name: decoded.name,
      role: decoded.role,
      departmentId: decoded.departmentId,
      position: decoded.position
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: '인증 토큰이 만료되었습니다. 다시 로그인해 주세요.'
      });
    }
    return res.status(401).json({
      success: false,
      error: '유효하지 않은 인증 토큰입니다.'
    });
  }
}

module.exports = { authenticateToken, generateToken, JWT_SECRET };
