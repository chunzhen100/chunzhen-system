/**
 * 淳珍100会员管理系统 - 认证中间件
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = 'chunzhen100_secret_key_2024';
const JWT_EXPIRES = '24h';

// 生成密码哈希
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// 验证密码
function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// 生成 JWT Token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// 验证 Token 中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// 管理员权限中间件
function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: '权限不足，需要管理员权限' });
  }
  next();
}

// 超级管理员权限中间件
function superAdminMiddleware(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: '权限不足，需要超级管理员权限' });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  authMiddleware,
  adminMiddleware,
  superAdminMiddleware,
  JWT_SECRET
};
