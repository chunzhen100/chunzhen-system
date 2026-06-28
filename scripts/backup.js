/**
 * 淳珍100会员管理系统 - 服务端备份脚本
 * 备份 SQLite 数据库到码云 Gitee
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  owner: 'wang-huifu',
  repo: 'chunzhen-backup',
  token: 'b03e57e1f61de83aeca6f8417bb96778',
  branch: 'master',
  dbPath: path.join(__dirname, 'data', 'database.sqlite'),
  keepDays: 90
};

function getDateStr() { return new Date().toISOString().slice(0, 10); }
function getTimeStr() { return new Date().toTimeString().slice(0, 8).replace(/:/g, '-'); }

function log(msg) {
  const t = new Date();
  console.log(`[${t.toISOString()}] ${msg}`);
}

// 创建备份文件
function createBackup() {
  const backupDir = path.join(__dirname, 'data', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const dbFile = CONFIG.dbPath;
  if (!fs.existsSync(dbFile)) {
    log('⚠️ 数据库文件不存在，创建空备份');
    return null;
  }

  const backupName = `database_${getDateStr()}_${getTimeStr()}.sqlite`;
  const backupPath = path.join(backupDir, backupName);
  
  // 复制数据库文件
  fs.copyFileSync(dbFile, backupPath);
  log(`✅ 本地备份: ${backupName} (${(fs.statSync(backupPath).size / 1024).toFixed(1)} KB)`);

  // 清理旧备份
  cleanupOld(backupDir);
  
  return backupPath;
}

// 清理旧备份（保留90天）
function cleanupOld(dir) {
  const files = fs.readdirSync(dir).filter(f => f.startsWith('database_'));
  const cutoff = Date.now() - CONFIG.keepDays * 86400000;
  let deleted = 0;
  
  files.forEach(f => {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fp);
      deleted++;
    }
  });
  
  if (deleted > 0) log(`🧹 已清理 ${deleted} 个旧备份`);
}

// 上传到码云
function pushToGitee(filePath) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath);
    const contentBase64 = content.toString('base64');
    
    // 构造请求数据
    const postData = JSON.stringify({
      message: `数据库备份 ${getDateStr()}`,
      content: contentBase64,
      branch: CONFIG.branch
    });

    const options = {
      hostname: 'gitee.com',
      port: 443,
      path: `/api/v5/repos/${CONFIG.owner}/${CONFIG.repo}/contents/backup/db/${fileName}`,
      method: 'POST',
      headers: {
        'Authorization': `token ${CONFIG.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 201) {
            log(`✅ 已上传到码云: backup/db/${fileName}`);
            resolve(result);
          } else if (res.statusCode === 422) {
            // 文件名已存在，尝试更新
            log('文件已存在，更新...');
            updateFile(fileName, contentBase64).then(resolve).catch(reject);
          } else {
            log(`❌ 上传失败: ${result.message || '未知错误'}`);
            reject(new Error(result.message));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 更新已存在的文件
function updateFile(fileName, contentBase64) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message: `数据库备份 ${getDateStr()}`,
      content: contentBase64,
      branch: CONFIG.branch
    });

    const options = {
      hostname: 'gitee.com',
      port: 443,
      path: `/api/v5/repos/${CONFIG.owner}/${CONFIG.repo}/contents/backup/db/${fileName}`,
      method: 'PUT',
      headers: {
        'Authorization': `token ${CONFIG.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        log(`✅ 已更新码云备份: ${result.content?.path || 'UNKNOWN'}`);
        resolve(result);
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 主函数
async function main() {
  log('========================================');
  log('淳珍100 - 数据库自动备份');
  log('========================================');
  
  try {
    const backupFile = createBackup();
    if (!backupFile) {
      log('⚠️ 没有数据库文件可备份');
      return;
    }
    
    await pushToGitee(backupFile);
    log('========================================');
    log('✅ 备份完成');
    log('========================================');
  } catch (err) {
    log(`❌ 备份失败: ${err.message}`);
    process.exit(1);
  }
}

main();
