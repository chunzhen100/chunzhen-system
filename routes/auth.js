/**
 * 淳珍100会员管理系统 - 认证路由
 */

const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');
const { hashPassword, verifyPassword, generateToken, authMiddleware, superAdminMiddleware } = require('../middleware/auth');

// 用户登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  stmt.bind([username]);
  let user = null;
  while (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();

  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  if (!verifyPassword(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = generateToken(user);
  
  // 记录登录日志
  logAction(user.id, user.username, '登录', '用户登录成功');

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name
    }
  });
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// 获取用户列表（管理员）
router.get('/users', authMiddleware, (req, res) => {
  const db = getDatabase();
  const stmt = db.prepare('SELECT id, username, role, display_name, created_at FROM users ORDER BY id');
  stmt.bind([]);
  const users = [];
  while (stmt.step()) {
    users.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(users);
});

// 创建用户（超级管理员）
router.post('/users', authMiddleware, superAdminMiddleware, (req, res) => {
  const { username, password, role, display_name } = req.body;
  if (!username || !password || !display_name) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const db = getDatabase();
  
  // 检查用户名是否已存在
  const checkStmt = db.prepare('SELECT id FROM users WHERE username = ?');
  checkStmt.bind([username]);
  if (checkStmt.step()) {
    checkStmt.free();
    return res.status(400).json({ error: '用户名已存在' });
  }
  checkStmt.free();

  const hashedPwd = hashPassword(password);
  const insertStmt = db.prepare('INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)');
  insertStmt.bind([username, hashedPwd, role || 'user', display_name]);
  insertStmt.step();
  insertStmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '创建用户', `创建用户: ${username} (${display_name})`);

  res.json({ success: true, message: '用户创建成功' });
});

// 删除用户（超级管理员）
router.delete('/users/:id', authMiddleware, superAdminMiddleware, (req, res) => {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM users WHERE id = ? AND role != ?');
  stmt.bind([req.params.id, 'super_admin']);
  stmt.step();
  stmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '删除用户', `删除用户ID: ${req.params.id}`);

  res.json({ success: true, message: '用户已删除' });
});

// 修改密码
router.put('/password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '请填写旧密码和新密码' });
  }

  const db = getDatabase();
  const stmt = db.prepare('SELECT password FROM users WHERE id = ?');
  stmt.bind([req.user.id]);
  let user = null;
  while (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();

  if (!user || !verifyPassword(oldPassword, user.password)) {
    return res.status(400).json({ error: '旧密码错误' });
  }

  const hashedPwd = hashPassword(newPassword);
  const updateStmt = db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  updateStmt.bind([hashedPwd, req.user.id]);
  updateStmt.step();
  updateStmt.free();
  saveDatabase();

  res.json({ success: true, message: '密码已修改' });
});

// 记录操作日志
function logAction(userId, username, action, details) {
  try {
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO operation_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)');
    stmt.bind([userId, username, action, details]);
    stmt.step();
    stmt.free();
    saveDatabase();
  } catch (e) {
    // 日志记录失败不影响主流程
  }
}

module.exports = router;
module.exports.logAction = logAction;
