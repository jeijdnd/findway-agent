/**
 * 无控制台窗口启动 Vite 开发服务器
 */
const { spawn } = require('child_process');
const path = require('path');

const frontendDir = path.join(__dirname, '..', 'frontend');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const child = spawn(npm, ['run', 'dev'], {
  cwd: frontendDir,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
});

child.unref();
