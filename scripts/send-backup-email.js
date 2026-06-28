/**
 * 发送备份到邮箱
 * 使用: node scripts/send-backup-email.js
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// QQ 邮箱配置
const EMAIL_CONFIG = {
  host: 'smtp.qq.com',
  port: 465,
  secure: true, // 使用 SSL
  auth: {
    user: '860251868@qq.com',
    pass: 'mlfggywnuadbbehj' // 你刚才给的授权码
  }
};

// 收件人
const RECIPIENT = '860251868@qq.com';

// 找到最新的备份文件
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
  console.error('❌ 备份目录不存在，请先运行 node scripts/email-backup.js');
  process.exit(1);
}

const backupFiles = fs.readdirSync(backupDir)
  .filter(f => f.startsWith('chunzhen-backup-') && f.endsWith('.sqlite'))
  .sort()
  .reverse();

if (backupFiles.length === 0) {
  console.error('❌ 没有找到备份文件，请先运行 node scripts/email-backup.js');
  process.exit(1);
}

const latestBackup = backupFiles[0];
const backupPath = path.join(backupDir, latestBackup);
const stats = fs.statSync(backupPath);

console.log(`📧 准备发送备份邮件...`);
console.log(`📦 备份文件: ${latestBackup}`);
console.log(`📏 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`📨 收件人: ${RECIPIENT}\n`);

// 创建邮件传输器
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// 邮件内容
const mailOptions = {
  from: `"淳珍100会员管理系统" <${EMAIL_CONFIG.auth.user}>`,
  to: RECIPIENT,
  subject: `【备份】淳珍100会员管理系统数据 - ${new Date().toLocaleDateString('zh-CN')}`,
  text: `
淳珍100会员管理系统 - 数据备份

备份时间: ${new Date().toLocaleString('zh-CN')}
备份文件: ${latestBackup}
文件大小: ${(stats.size / 1024).toFixed(2)} KB

使用方法:
1. 下载附件中的 .sqlite 文件
2. 将文件放置到 chunzhen-server/data/ 目录
3. 重启服务器即可恢复数据

系统信息:
- 数据库类型: SQLite
- 备份方式: 自动每日备份
- 保留份数: 最近 30 天

如有问题，请联系技术支持。
  `,
  attachments: [
    {
      filename: latestBackup,
      path: backupPath,
      contentType: 'application/x-sqlite3'
    }
  ]
};

// 发送邮件
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('❌ 邮件发送失败:', error.message);
    process.exit(1);
  } else {
    console.log('✅ 邮件发送成功！');
    console.log(`📧 邮件ID: ${info.messageId}`);
    console.log(`📨 已发送到: ${RECIPIENT}`);
    console.log(`\n请检查邮箱（包括垃圾箱），确认收到备份文件。`);
  }
});
