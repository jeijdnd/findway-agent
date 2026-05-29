/**
 * 桌面端开发入口：后台启动 Vite + Electron，不占用可见终端
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..');

function runHidden(scriptName) {
  const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return child;
}

function waitForVite(maxAttempts = 60, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const poll = () => {
      const req = http.get('http://localhost:5173', (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        attempts += 1;
        if (attempts >= maxAttempts) {
          reject(new Error('Vite dev server failed to start'));
          return;
        }
        setTimeout(poll, intervalMs);
      });
      req.setTimeout(1500, () => {
        req.destroy();
        attempts += 1;
        if (attempts >= maxAttempts) {
          reject(new Error('Vite dev server failed to start'));
          return;
        }
        setTimeout(poll, intervalMs);
      });
    };
    poll();
  });
}

runHidden('start-vite.js');

waitForVite()
  .then(() => {
    runHidden('start-electron.js');
  })
  .catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
