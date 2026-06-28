/**
 * 淳珍100会员管理系统 - 订单管理路由
 */

const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');
const { authMiddleware, superAdminMiddleware } = require('../middleware/auth');
const { logAction } = require('./auth');

// 获取所有订单
router.get('/', authMiddleware, (req, res) => {
  const db = getDatabase();
  const customerId = req.query.customer_id;
  let sql = `
    SELECT o.*, c.name as customer_name 
    FROM orders o 
    LEFT JOIN customers c ON o.customer_id = c.id
  `;
  const params = [];
  if (customerId) {
    sql += ' WHERE o.customer_id = ?';
    params.push(customerId);
  }
  sql += ' ORDER BY o.created_at DESC';
  
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const orders = [];
  while (stmt.step()) {
    orders.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(orders);
});

// 获取单个订单
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT o.*, c.name as customer_name 
    FROM orders o 
    LEFT JOIN customers c ON o.customer_id = c.id 
    WHERE o.id = ?
  `);
  stmt.bind([req.params.id]);
  if (stmt.step()) {
    const order = stmt.getAsObject();
    stmt.free();
    
    // 获取该订单的领用记录
    const pickupStmt = db.prepare('SELECT SUM(quantity) as total FROM pickups WHERE order_id = ?');
    pickupStmt.bind([order.id]);
    if (pickupStmt.step()) {
      order.picked_count = pickupStmt.getAsObject().total || 0;
    }
    pickupStmt.free();
    
    res.json(order);
  } else {
    stmt.free();
    res.status(404).json({ error: '订单不存在' });
  }
});

// 新增订单
router.post('/', authMiddleware, (req, res) => {
  const { customer_id, order_name, product_name, quantity, price, paid, notes } = req.body;
  if (!customer_id || !order_name) {
    return res.status(400).json({ error: '请填写客户和订单名称' });
  }

  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO orders (customer_id, order_name, product_name, quantity, price, paid, notes, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([customer_id, order_name, product_name || '', quantity || 1, price || 0, paid || 0, notes || '', req.user.id]);
  stmt.step();
  stmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '新增订单', `订单: ${order_name}`);
  res.json({ success: true, message: '订单创建成功' });
});

// 更新订单
router.put('/:id', authMiddleware, (req, res) => {
  const { customer_id, order_name, product_name, quantity, price, paid, status, notes } = req.body;
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE orders SET customer_id=?, order_name=?, product_name=?, quantity=?, price=?, paid=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP 
    WHERE id=?
  `);
  stmt.bind([customer_id, order_name, product_name, quantity, price, paid, status || 'active', notes, req.params.id]);
  stmt.step();
  stmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '更新订单', `订单ID: ${req.params.id}`);
  res.json({ success: true, message: '订单已更新' });
});

// 删除订单（超级管理员）
router.delete('/:id', authMiddleware, superAdminMiddleware, (req, res) => {
  const db = getDatabase();
  db.run('DELETE FROM pickups WHERE order_id = ?', [req.params.id]);
  db.run('DELETE FROM orders WHERE id = ?', [req.params.id]);
  saveDatabase();

  logAction(req.user.id, req.user.username, '删除订单', `订单ID: ${req.params.id}`);
  res.json({ success: true, message: '订单已删除' });
});

module.exports = router;
