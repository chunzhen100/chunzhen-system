/**
 * 上传 chunzhen-server 到 Gitee 仓库
 * 使用 Gitee API 直接创建文件
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  owner: 'wang-huifu',
  repo: 'chunzhen-backup',
  branch: 'master',
  token: 'b03e57e1f61de83aeca6f8417bb96778',
  localDir: path.join(__dirname, '..')
};

// 跳过上传的文件
const SKIP_FILES = ['node_modules', 'data', '.git', 'package-lock.json'];

// API 请求
function apiRequest(method, apiPath, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : '';
    const options = {
      hostname: 'gitee.com',
      port: 443,
      path: `/api/v5/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${apiPath}`,
      method,
      headers: {
        'Authorization': `token ${CONFIG.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'chunzhen-push/1.0'
      }
    };
    
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);
    
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: d });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// 尝试获取文件 SHA（用于更新）
async function getFileSha(filePath) {
  try {
    const result = await apiRequest('GET', filePath, null);
    if (result.status === 200 && result.data.sha) {
      return result.data.sha;
    }
  } catch (e) {}
  return null;
}

// 上传单个文件
async function uploadFile(localPath, remotePath) {
  const content = fs.readFileSync(localPath, 'utf8');
  const contentBase64 = Buffer.from(content).toString('base64');
  
  const sha = await getFileSha(remotePath);
  const data = {
    message: `Add ${remotePath}`,
    content: contentBase64,
    branch: CONFIG.branch
  };
  if (sha) {
    data.sha = sha;
    data.message = `Update ${remotePath}`;
  }
  
  const result = await apiRequest(sha ? 'PUT' : 'POST', remotePath, data);
  
  if (result.status === 201 || result.status === 200 || result.status === 422) {
    // 422 可能是因为文件存在但没传 sha，重试
    if (result.status === 422 && !sha) {
      const newSha = await getFileSha(remotePath);
      if (newSha) {
        data.sha = newSha;
        data.message = `Update ${remotePath}`;
        const retry = await apiRequest('PUT', remotePath, data);
        if (retry.status === 200 || retry.status === 201) {
          console.log(`  ✅ ${remotePath} (updated)`);
          return true;
        }
      }
      console.log(`  ⚠️  ${remotePath} (exists, skipped)`);
      return true;
    }
    console.log(`  ✅ ${remotePath}`);
    return true;
  } else {
    console.log(`  ❌ ${remotePath}: ${typeof result.data === 'string' ? result.data : result.data.message}`);
    return false;
  }
}

// 遍历目录
async function walkDir(dir, baseDir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (SKIP_FILES.includes(entry.name)) continue;
    
    const fullPath = path.join(dir, entry.name);
    const remotePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    
    if (entry.isDirectory()) {
      // 递归
      await walkDir(fullPath, baseDir, remotePath);
    } else {
      // 上传文件
      await uploadFile(fullPath, `chunzhen-server/${remotePath}`);
    }
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('  推送 chunzhen-server 到码云');
  console.log('========================================\n');
  
  // 先检查仓库是否存在
  console.log('📡 检查仓库...');
  const repoCheck = await apiRequest('GET', '', null);
  if (repoCheck.status !== 200) {
    console.log(`❌ 仓库不存在或无权访问: ${JSON.stringify(repoCheck.data)}`);
    return;
  }
  console.log(`✅ 仓库存在: ${CONFIG.owner}/${CONFIG.repo}\n`);
  
  console.log('📤 开始上传文件...\n');
  
  const localDir = path.join(CONFIG.localDir);
  await walkDir(localDir, localDir);
  
  console.log('\n========================================');
  console.log('✅ 推送完成！');
  console.log('  仓库地址: https://gitee.com/wang-huifu/chunzhen-backup');
  console.log('  chunzhen-server 目录已上传');
  console.log('========================================');
}

main().catch(console.error);
