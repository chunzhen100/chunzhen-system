/**
 * 淳珍100会员管理系统 - 领用记录路由
 */

const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction } = require('./auth');

// 获取领用记录
router.get('/', authMiddleware, (req, res) => {
  const db = getDatabase();
  const customerId = req.query.customer_id;
  const orderId = req.query.order_id;
  
  let sql = `
    SELECT p.*, c.name as customer_name, o.order_name 
    FROM pickups p 
    LEFT JOIN customers c ON p.customer_id = c.id 
    LEFT JOIN orders o ON p.order_id = o.id
  `;
  const params = [];
  const conditions = [];
  
  if (customerId) {
    conditions.push('p.customer_id = ?');
    params.push(customerId);
  }
  if (orderId) {
    conditions.push('p.order_id = ?');
    params.push(orderId);
  }
  
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY p.created_at DESC';
  
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const pickups = [];
  while (stmt.step()) {
    pickups.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(pickups);
});

// 新增领用记录
router.post('/', authMiddleware, (req, res) => {
  const { order_id, customer_id, product_name, quantity, pickup_date, notes } = req.body;
  if (!customer_id || !product_name) {
    return res.status(400).json({ error: '请填写客户和产品名称' });
  }

  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO pickups (order_id, customer_id, product_name, quantity, pickup_date, notes, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([
    order_id || null, 
    customer_id, 
    product_name, 
    quantity || 1, 
    pickup_date || new Date().toISOString().slice(0, 10), 
    notes || '', 
    req.user.id
  ]);
  stmt.step();
  stmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '新增领用', `${product_name} x${quantity}`);
  res.json({ success: true, message: '领用记录已添加' });
});

// 删除领用记录（管理员）
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDatabase();
  db.run('DELETE FROM pickups WHERE id = ?', [req.params.id]);
  saveDatabase();

  logAction(req.user.id, req.user.username, '删除领用', `领用ID: ${req.params.id}`);
  res.json({ success: true, message: '领用记录已删除' });
});

module.exports = router;
