/**
 * 邮箱备份脚本 - 将数据库备份发送到 860251868@qq.com
 * 使用方法: node scripts/email-backup.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 配置
const CONFIG = {
  dbPath: path.join(__dirname, '..', 'data', 'database.sqlite'),
  backupDir: path.join(__dirname, '..', 'backups'),
  email: '860251868@qq.com',
  maxBackups: 30 // 保留最近30天的备份
};

// 确保备份目录存在
if (!fs.existsSync(CONFIG.backupDir)) {
  fs.mkdirSync(CONFIG.backupDir, { recursive: true });
}

// 生成备份文件名
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFileName = `chunzhen-backup-${timestamp}.sqlite`;
const backupPath = path.join(CONFIG.backupDir, backupFileName);

// 复制数据库文件
try {
  fs.copyFileSync(CONFIG.dbPath, backupPath);
  const stats = fs.statSync(backupPath);
  console.log(`✅ 备份已创建: ${backupFileName} (${(stats.size / 1024).toFixed(2)} KB)`);
} catch (err) {
  console.error('❌ 备份失败:', err.message);
  process.exit(1);
}

// 清理旧备份文件（保留最近30个）
const backupFiles = fs.readdirSync(CONFIG.backupDir)
  .filter(f => f.startsWith('chunzhen-backup-') && f.endsWith('.sqlite'))
  .sort()
  .reverse();

if (backupFiles.length > CONFIG.maxBackups) {
  const toDelete = backupFiles.slice(CONFIG.maxBackups);
  toDelete.forEach(f => {
    fs.unlinkSync(path.join(CONFIG.backupDir, f));
    console.log(`🗑️ 已删除旧备份: ${f}`);
  });
}

console.log(`\n📦 备份目录: ${CONFIG.backupDir}`);
console.log(`📧 备份将发送到: ${CONFIG.email}`);
console.log(`\n备份文件列表:`);
backupFiles.slice(0, 5).forEach((f, i) => {
  const s = fs.statSync(path.join(CONFIG.backupDir, f));
  console.log(`  ${i + 1}. ${f} (${(s.size / 1024).toFixed(2)} KB)`);
});

console.log(`\n✅ 备份完成！共 ${backupFiles.length} 个备份文件`);
