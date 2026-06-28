/**
 * 淳珍100会员管理系统 - 销售管理路由
 */

const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction } = require('./auth');

// 获取销售记录
router.get('/', authMiddleware, (req, res) => {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM sales ORDER BY created_at DESC');
  stmt.bind([]);
  const sales = [];
  while (stmt.step()) {
    sales.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(sales);
});

// 新增销售记录
router.post('/', authMiddleware, (req, res) => {
  const { order_id, product_name, quantity, price, payment_method, sale_date, notes } = req.body;
  if (!product_name || !quantity || !price) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO sales (order_id, product_name, quantity, price, payment_method, sale_date, notes, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([
    order_id || null,
    product_name,
    quantity,
    price,
    payment_method || '现金',
    sale_date || new Date().toISOString().slice(0, 10),
    notes || '',
    req.user.id
  ]);
  stmt.step();
  stmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '新增销售', `${product_name} x${quantity} ¥${price}`);
  res.json({ success: true, message: '销售记录已添加' });
});

// 获取销售统计
router.get('/stats', authMiddleware, (req, res) => {
  const db = getDatabase();
  
  // 总销售额
  const totalStmt = db.prepare('SELECT COALESCE(SUM(price), 0) as total_sales, COUNT(*) as total_count FROM sales');
  totalStmt.bind([]);
  const stats = totalStmt.step() ? totalStmt.getAsObject() : { total_sales: 0, total_count: 0 };
  totalStmt.free();

  // 按产品统计
  const productStmt = db.prepare('SELECT product_name, SUM(quantity) as qty, SUM(price) as total FROM sales GROUP BY product_name ORDER BY total DESC');
  productStmt.bind([]);
  const byProduct = [];
  while (productStmt.step()) {
    byProduct.push(productStmt.getAsObject());
  }
  productStmt.free();

  res.json({ ...stats, by_product: byProduct });
});

module.exports = router;
