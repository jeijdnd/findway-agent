/**
 * 无控制台窗口启动 Electron（开发模式）
 */
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const electron = require('electron');

const child = spawn(electron, ['.'], {
  cwd: root,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
});

child.unref();
