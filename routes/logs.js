/**
 * 淳珍100会员管理系统 - 操作日志路由
 */

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const { authMiddleware } = require('../middleware/auth');

// 获取操作日志
router.get('/', authMiddleware, (req, res) => {
  const db = getDatabase();
  const limit = Math.min(parseInt(req.query.limit) || 500, 500);
  
  const stmt = db.prepare('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ?');
  stmt.bind([limit]);
  const logs = [];
  while (stmt.step()) {
    logs.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(logs);
});

// 数据导出（管理员）
router.get('/export', authMiddleware, (req, res) => {
  const db = getDatabase();
  const { table } = req.query;
  
  const allowedTables = ['customers', 'orders', 'pickups', 'products', 'stock_ins', 'sales', 'operation_logs'];
  if (!table || !allowedTables.includes(table)) {
    return res.status(400).json({ error: '请指定有效的表名' });
  }

  const stmt = db.prepare(`SELECT * FROM ${table}`);
  stmt.bind([]);
  const data = [];
  while (stmt.step()) {
    data.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(data);
});

module.exports = router;
