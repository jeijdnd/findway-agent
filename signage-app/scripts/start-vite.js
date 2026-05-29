/**
 * 启动 Vite 开发服务器
 * FINDWAY_DETACHED=1 时后台运行（供 desktop.bat）；否则保持前台（供 dev:inner）
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendDir = path.join(__dirname, '..', 'frontend');
const viteBin = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');
const foreground = process.argv.includes('--foreground');
const detached = !foreground && process.env.FINDWAY_DETACHED === '1';

if (!fs.existsSync(viteBin)) {
  console.error('Vite not found. Run: cd frontend && npm install');
  process.exit(1);
}

const child = spawn(process.execPath, [viteBin], {
  cwd: frontendDir,
  detached,
  stdio: detached ? 'ignore' : 'inherit',
  windowsHide: true,
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
