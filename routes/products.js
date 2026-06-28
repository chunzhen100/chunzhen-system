/**
 * 淳珍100会员管理系统 - 产品管理路由
 */

const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');
const { authMiddleware, superAdminMiddleware } = require('../middleware/auth');
const { logAction } = require('./auth');

// 获取所有产品
router.get('/', authMiddleware, (req, res) => {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM products ORDER BY name');
  stmt.bind([]);
  const products = [];
  while (stmt.step()) {
    products.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(products);
});

// 新增产品（管理员）
router.post('/', authMiddleware, (req, res) => {
  const { name, days_per_box, notes } = req.body;
  if (!name) {
    return res.status(400).json({ error: '请填写产品名称' });
  }

  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO products (name, days_per_box, notes) VALUES (?, ?, ?)');
  stmt.bind([name, days_per_box || 30, notes || '']);
  stmt.step();
  stmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '新增产品', `产品: ${name}`);
  res.json({ success: true, message: '产品添加成功' });
});

// 更新产品
router.put('/:id', authMiddleware, (req, res) => {
  const { name, days_per_box, notes } = req.body;
  const db = getDatabase();
  const stmt = db.prepare('UPDATE products SET name=?, days_per_box=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
  stmt.bind([name, days_per_box || 30, notes || '', req.params.id]);
  stmt.step();
  stmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '更新产品', `产品ID: ${req.params.id}`);
  res.json({ success: true, message: '产品已更新' });
});

// 删除产品（超级管理员）
router.delete('/:id', authMiddleware, superAdminMiddleware, (req, res) => {
  const db = getDatabase();
  db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
  saveDatabase();

  logAction(req.user.id, req.user.username, '删除产品', `产品ID: ${req.params.id}`);
  res.json({ success: true, message: '产品已删除' });
});

module.exports = router;
