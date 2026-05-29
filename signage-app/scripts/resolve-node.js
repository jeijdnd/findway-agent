/**
 * 解析可用的 Node.js 可执行文件路径（避免 VBS/Explorer 环境 PATH 不完整）
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CANDIDATES = [
  process.env.FINDWAY_NODE,
  process.platform === 'win32' ? 'C:\\Program Files\\nodejs\\node.exe' : null,
  process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || '', 'Programs', 'node', 'node.exe')
    : null,
  process.platform === 'win32'
    ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe')
    : null,
  process.execPath,
].filter(Boolean);

function resolveNodeExecutable() {
  for (const candidate of CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) {
      return path.normalize(candidate);
    }
  }
  if (process.platform === 'win32') {
    try {
      const out = execSync('where node', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const line of out.split(/\r?\n/)) {
        const p = line.trim();
        if (!p) continue;
        if (/cursor|vscode|adobe/i.test(p)) continue;
        if (fs.existsSync(p)) return path.normalize(p);
      }
    } catch {
      // ignore
    }
  }
  return 'node';
}

module.exports = { resolveNodeExecutable };
