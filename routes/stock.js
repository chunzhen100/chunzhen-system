/**
 * 淳珍100会员管理系统 - 库存管理路由
 */

const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction } = require('./auth');

// 获取库存统计
router.get('/', authMiddleware, (req, res) => {
  const db = getDatabase();

  // 获取所有产品
  const productStmt = db.prepare('SELECT DISTINCT name FROM products');
  productStmt.bind([]);

  // 从领用记录和入库记录中获取所有出现的产品名
  const allProductsStmt = db.prepare(`
    SELECT DISTINCT product_name FROM (
      SELECT product_name FROM stock_ins
      UNION
      SELECT product_name FROM pickups
      UNION
      SELECT name as product_name FROM products
    ) ORDER BY product_name
  `);
  allProductsStmt.bind([]);
  
  const stockData = [];
  while (allProductsStmt.step()) {
    const row = allProductsStmt.getAsObject();
    const productName = row.product_name;

    // 入库总量
    const inStmt = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM stock_ins WHERE product_name = ?');
    inStmt.bind([productName]);
    let stockInTotal = 0;
    if (inStmt.step()) stockInTotal = inStmt.getAsObject().total;
    inStmt.free();

    // 已领取总量
    const outStmt = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM pickups WHERE product_name = ?');
    outStmt.bind([productName]);
    let pickedTotal = 0;
    if (outStmt.step()) pickedTotal = outStmt.getAsObject().total;
    outStmt.free();

    // 实际库存 = 入库 - 已领取
    const realStock = stockInTotal - pickedTotal;

    stockData.push({
      product_name: productName,
      stock_in_total: stockInTotal,
      picked_total: pickedTotal,
      real_stock: Math.max(0, realStock)
    });
  }
  allProductsStmt.free();

  res.json(stockData);
});

// 入库操作
router.post('/in', authMiddleware, (req, res) => {
  const { product_name, quantity, stock_date, notes } = req.body;
  if (!product_name || !quantity) {
    return res.status(400).json({ error: '请填写产品和数量' });
  }

  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO stock_ins (product_name, quantity, stock_date, notes, created_by) VALUES (?, ?, ?, ?, ?)');
  stmt.bind([product_name, quantity, stock_date || new Date().toISOString().slice(0, 10), notes || '', req.user.id]);
  stmt.step();
  stmt.free();
  saveDatabase();

  logAction(req.user.id, req.user.username, '入库', `${product_name} x${quantity}`);
  res.json({ success: true, message: '入库成功' });
});

// 获取入库记录
router.get('/in', authMiddleware, (req, res) => {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM stock_ins ORDER BY created_at DESC');
  stmt.bind([]);
  const records = [];
  while (stmt.step()) {
    records.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(records);
});

module.exports = router;
