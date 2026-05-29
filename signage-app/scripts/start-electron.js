/**
 * 启动 Electron（开发模式）
 * FINDWAY_DETACHED=1 时后台运行（供 desktop.bat）；否则保持前台（供 dev:inner）
 */
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const electron = require('electron');
const detached = process.env.FINDWAY_DETACHED === '1';

const child = spawn(electron, ['.'], {
  cwd: root,
  detached,
  stdio: detached ? 'ignore' : 'inherit',
  windowsHide: false,
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
});

if (detached) {
  child.unref();
} else {
  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
  child.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
}
