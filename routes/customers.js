/**
 * 淳珍100会员管理系统 - 客户管理路由
 */

const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');
const { authMiddleware, superAdminMiddleware } = require('../middleware/auth');
const { logAction } = require('./auth');

// 获取所有客户
router.get('/', authMiddleware, (req, res) => {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM customers ORDER BY name');
  stmt.bind([]);
  const customers = [];
  while (stmt.step()) {
    const c = stmt.getAsObject();
    // 获取客户的订单数量
    const orderStmt = db.prepare('SELECT COUNT(*) as count FROM orders WHERE customer_id = ?');
    orderStmt.bind([c.id]);
    if (orderStmt.step()) {
      c.order_count = orderStmt.getAsObject().count;
    }
    orderStmt.free();
    customers.push(c);
  }
  stmt.free();
  res.json(customers);
});

// 获取单个客户
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM customers WHERE id = ?');
  stmt.bind([req.params.id]);
  if (stmt.step()) {
    res.json(stmt.getAsObject());
  } else {
    res.status(404).json({ error: '客户不存在' });
  }
  stmt.free();
});

// 新增客户
router.post('/', authMiddleware, (req, res) => {
  const { name, phone, address, notes } = req.body;
  if (!name) {
    return res.status(400).json({ error: '请填写客户姓名' });
  }

  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO customers (name, phone, address, notes, created_by) VALUES (?, ?, ?, ?, ?)');
  stmt.bind([name, phone || '', address || '', notes || '', req.user.id]);
  stmt.step();
  stmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '新增客户', `客户: ${name}`);

  res.json({ success: true, message: '客户添加成功' });
});

// 更新客户
router.put('/:id', authMiddleware, (req, res) => {
  const { name, phone, address, notes } = req.body;
  const db = getDatabase();
  const stmt = db.prepare('UPDATE customers SET name = ?, phone = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.bind([name, phone || '', address || '', notes || '', req.params.id]);
  stmt.step();
  stmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '更新客户', `客户ID: ${req.params.id}`);

  res.json({ success: true, message: '客户已更新' });
});

// 删除客户（超级管理员）
router.delete('/:id', authMiddleware, superAdminMiddleware, (req, res) => {
  const db = getDatabase();
  
  // 先删除相关订单和领用记录
  db.run('DELETE FROM pickups WHERE customer_id = ?', [req.params.id]);
  db.run('DELETE FROM orders WHERE customer_id = ?', [req.params.id]);
  db.run('DELETE FROM customers WHERE id = ?', [req.params.id]);
  saveDatabase();

  logAction(req.user.id, req.user.username, '删除客户', `客户ID: ${req.params.id}`);

  res.json({ success: true, message: '客户已删除' });
});

module.exports = router;
