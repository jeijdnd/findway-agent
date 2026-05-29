/**
 * 桌面端启动入口（desktop.bat 调用）
 * - 清理残留端口
 * - 启动 Vite → 等待就绪 → 启动 Electron
 * - 日志与失败弹窗
 */
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { resolveNodeExecutable } = require('./resolve-node');

const root = path.join(__dirname, '..');
const nodeExe = resolveNodeExecutable();
const logDir = path.join(process.env.APPDATA || root, 'FindWay-Agent');
const logFile = path.join(logDir, 'launch.log');

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, line, 'utf8');
  } catch {
    // ignore
  }
}

function showError(message) {
  log(`ERROR: ${message}`);
  if (process.platform !== 'win32') return;
  try {
    const safe = message.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${safe}','FindWay Agent 启动失败')"`
      ,
      { stdio: 'ignore', windowsHide: true },
    );
  } catch {
    // ignore
  }
}

function killPort(port) {
  if (process.platform !== 'win32') return;
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = new Set();
    for (const line of out.split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[parts.length - 1], 10);
      if (pid > 0) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
        log(`killed PID ${pid} on port ${port}`);
      } catch {
        // ignore
      }
    }
  } catch {
    // port free
  }
}

function spawnHidden(scriptName, extraEnv = {}) {
  const child = spawn(nodeExe, [path.join(__dirname, scriptName)], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, FINDWAY_DETACHED: '1', ...extraEnv },
  });
  child.unref();
  return child;
}

function waitForUrl(url, maxAttempts = 60, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const poll = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else retry();
      });
      req.on('error', retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      attempts += 1;
      if (attempts >= maxAttempts) {
        reject(new Error(`等待超时: ${url}`));
        return;
      }
      setTimeout(poll, intervalMs);
    };
    poll();
  });
}

async function main() {
  log(`launch start (node=${nodeExe})`);
  killPort(5173);
  killPort(8765);

  spawnHidden('start-vite.js');
  log('vite starting...');

  await waitForUrl('http://localhost:5173');
  log('vite ready');

  spawnHidden('start-electron.js');
  log('electron starting...');

  // Electron 自行拉起后端，稍等确认
  try {
    await waitForUrl('http://127.0.0.1:8765/api/health', 40, 500);
    log('backend ready');
  } catch {
    log('backend health check skipped or slow');
  }

  log('launch complete');
}

main().catch((err) => {
  showError(`${err.message}\n\n详见: ${logFile}`);
  process.exit(1);
});
