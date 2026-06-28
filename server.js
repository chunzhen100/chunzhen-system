/**
 * 淳珍100会员管理系统 - 后端服务器
 * 基于 Node.js + Express + SQLite
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { initDatabase, closeDatabase } = require('./database');
const { hashPassword } = require('./middleware/auth');

// 路由
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const pickupRoutes = require('./routes/pickups');
const productRoutes = require('./routes/products');
const stockRoutes = require('./routes/stock');
const salesRoutes = require('./routes/sales');
const logRoutes = require('./routes/logs');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 限流：每IP每分钟最多100次请求
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: '请求太频繁，请稍后再试' }
});
app.use('/api/', limiter);

// 静态文件服务（前端页面）
app.use(express.static(path.join(__dirname, 'public')));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/pickups', pickupRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/logs', logRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 所有其他路径重定向到前端
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 初始化默认用户
async function initDefaultUsers() {
  const db = require('./database').getDatabase();
  
  // 检查是否已有用户
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  checkStmt.bind([]);
  let count = 0;
  if (checkStmt.step()) {
    count = checkStmt.getAsObject().count;
  }
  checkStmt.free();

  if (count === 0) {
    console.log('📝 初始化默认用户...');
    
    const users = [
      { username: 'admin', password: 'chunzhen100', role: 'super_admin', display_name: '超级管理员' },
      { username: 'meidong', password: 'meidong2024', role: 'user', display_name: '美东店' },
      { username: 'tandong', password: 'tandong2024', role: 'user', display_name: '谈东店' }
    ];

    for (const user of users) {
      const hashedPwd = hashPassword(user.password);
      const insertStmt = db.prepare('INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)');
      insertStmt.bind([user.username, hashedPwd, user.role, user.display_name]);
      insertStmt.step();
      insertStmt.free();
    }
    
    const saveDB = require('./database').saveDatabase;
    saveDB();
    
    console.log('✅ 默认用户创建完成');
    console.log('   admin     密码: chunzhen100 (超级管理员)');
    console.log('   meidong   密码: meidong2024  (美东店)');
    console.log('   tandong   密码: tandong2024  (谈东店)');
  }
}

// 启动服务器
async function start() {
  try {
    await initDatabase();
    await initDefaultUsers();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('==========================================');
      console.log('  淳珍100会员管理系统 - 后端服务已启动');
      console.log(`  地址: http://localhost:${PORT}`);
      console.log('==========================================');
      console.log('');
    });
  } catch (err) {
    console.error('❌ 启动失败:', err);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n⏳ 正在关闭服务器...');
  closeDatabase();
  process.exit(0);
});

start();
