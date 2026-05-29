/**
 * FindWay Agent Electron 主进程
 * 启动隐藏后端子进程，管理窗口与系统托盘
 */
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { t } = require('./i18n');

const FAVICON_PATH = path.join(__dirname, '..', 'frontend', 'public', 'favicon.ico');
const ELECTRON_EXE_ICON = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');

/** 返回可用的托盘/窗口图标 */
function resolveAppIcon() {
  const candidates = [FAVICON_PATH, ELECTRON_EXE_ICON, process.execPath];
  for (const iconPath of candidates) {
    if (!iconPath || !fs.existsSync(iconPath)) continue;
    try {
      const image = nativeImage.createFromPath(iconPath);
      if (!image.isEmpty()) {
        return image.resize({ width: 16, height: 16 });
      }
    } catch (err) {
      console.warn('Failed to load icon:', iconPath, err.message);
    }
  }
  return null;
}

function normalizeWindowBounds(bounds) {
  const { screen } = require('electron');
  const displays = screen.getAllDisplays();
  const width = bounds.width || 1400;
  const height = bounds.height || 900;
  let x = bounds.x;
  let y = bounds.y;

  if (typeof x !== 'number' || typeof y !== 'number') {
    const primary = screen.getPrimaryDisplay();
    x = primary.workArea.x + Math.max(0, Math.floor((primary.workArea.width - width) / 2));
    y = primary.workArea.y + Math.max(0, Math.floor((primary.workArea.height - height) / 2));
    return { x, y, width, height };
  }

  const onScreen = displays.some((display) => {
    const area = display.workArea;
    return x < area.x + area.width - 80
      && y < area.y + area.height - 80
      && x + width > area.x + 80
      && y + height > area.y + 80;
  });

  if (!onScreen) {
    const primary = screen.getPrimaryDisplay();
    x = primary.workArea.x + Math.max(0, Math.floor((primary.workArea.width - width) / 2));
    y = primary.workArea.y + Math.max(0, Math.floor((primary.workArea.height - height) / 2));
  }

  return { x, y, width, height };
}

const APP_ROOT = path.join(__dirname, '..');
const BACKEND_PORT = 8765;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const BACKEND_HEALTH_URL = `${BACKEND_URL}/api/health`;
const VITE_DEV_URL = 'http://localhost:5173';
const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

let pythonProcess = null;
let backendStartedByApp = false;

/** %APPDATA%/FindWay-Agent 数据目录 */
function getFindWayAgentDataDir() {
  const appData = process.env.APPDATA || app.getPath('userData');
  const dir = path.join(appData, 'FindWay-Agent');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const defaultWindowBounds = { x: undefined, y: undefined, width: 1400, height: 900 };
let store;

try {
  const Store = require('electron-store');
  store = new Store({
    defaults: {
      windowBounds: defaultWindowBounds,
      isMaximized: false
    }
  });
} catch (err) {
  console.error('electron-store unavailable:', err);
  store = {
    get(key) {
      if (key === 'windowBounds') return defaultWindowBounds;
      if (key === 'isMaximized') return false;
      return undefined;
    },
    set() {}
  };
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

function getPythonExecutable() {
  const venvPython = path.join(APP_ROOT, 'venv', 'Scripts', 'python.exe');
  if (process.platform === 'win32' && fs.existsSync(venvPython)) {
    return venvPython;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get(BACKEND_HEALTH_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(false);
          return;
        }
        try {
          const json = JSON.parse(data);
          resolve(json.status === 'ok');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/** 检查运行中的后端是否包含必需 API（避免旧进程导致 404） */
const REQUIRED_BACKEND_FEATURES = ['scan-folder', 'file-browser', 'project-path-config'];

function checkBackendHasRequiredFeatures() {
  return new Promise((resolve) => {
    const req = http.get(BACKEND_HEALTH_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const features = Array.isArray(json.features) ? json.features : [];
          resolve(REQUIRED_BACKEND_FEATURES.every((f) => features.includes(f)));
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/** @deprecated 保留兼容；请使用 checkBackendHasRequiredFeatures */
function checkBackendHasFileBrowser() {
  return checkBackendHasRequiredFeatures();
}

/** 终止进程树（含子进程） */
function killProcessTree(pid) {
  if (!pid || pid === process.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
  } catch {
    if (process.platform === 'win32') {
      try {
        execSync(
          `powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`,
          { stdio: 'ignore' },
        );
      } catch {
        // 进程可能已退出
      }
    }
  }
}

/** 收集占用端口及 uvicorn 僵尸子进程 PID */
function collectStaleBackendPids(port) {
  const pids = new Set();

  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      for (const line of out.split('\n')) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (pid > 0) pids.add(pid);
      }
    } else {
      const out = execSync(`lsof -ti :${port} -sTCP:LISTEN`, { encoding: 'utf8' });
      for (const line of out.trim().split('\n')) {
        const pid = parseInt(line, 10);
        if (pid > 0) pids.add(pid);
      }
    }
  } catch {
    // 端口无监听
  }

  try {
    if (process.platform === 'win32') {
      const ps = [
        'Get-CimInstance Win32_Process | Where-Object {',
        "$_.Name -match '^python'",
        '} | Where-Object {',
        `($_.CommandLine -match 'uvicorn' -and $_.CommandLine -match 'backend\\.main' -and $_.CommandLine -match '${port}')`,
        "-or $_.CommandLine -match 'multiprocessing\\.spawn'",
        '} | Select-Object -ExpandProperty ProcessId',
      ].join(' ');
      const out = execSync(`powershell -NoProfile -Command "${ps}"`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 4 * 1024 * 1024,
      });
      for (const line of out.split(/\r?\n/)) {
        const pid = parseInt(line.trim(), 10);
        if (pid > 0) pids.add(pid);
      }
    } else {
      const out = execSync(`pgrep -f "uvicorn.*backend.main.*--port ${port}"`, { encoding: 'utf8' });
      for (const line of out.trim().split('\n')) {
        const pid = parseInt(line, 10);
        if (pid > 0) pids.add(pid);
      }
    }
  } catch {
    // 无匹配 Python 进程
  }

  return pids;
}

/**
 * 清理 8765 端口残留后端（含 uvicorn --reload 孤儿子进程）
 * REQUIREMENTS P0：启动/关闭时自动清理僵尸进程
 */
function cleanupBackendPort(port, { delayMs = 800 } = {}) {
  const pids = collectStaleBackendPids(port);
  if (pids.size > 0) {
    console.log(`[backend] cleaning port ${port}, PIDs: ${[...pids].join(', ')}`);
    for (const pid of pids) {
      killProcessTree(pid);
    }
  } else {
    console.log(`[backend] port ${port}: no stale processes`);
  }
  if (delayMs > 0) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return Promise.resolve();
}

/** @deprecated 请使用 cleanupBackendPort */
function killProcessOnPort(port) {
  return cleanupBackendPort(port, { delayMs: 0 });
}

function waitForBackend(maxAttempts = 30, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const poll = async () => {
      if (await checkBackendHealth()) {
        resolve();
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        reject(new Error('Python backend failed to start (health check timeout)'));
        return;
      }
      setTimeout(poll, intervalMs);
    };
    poll();
  });
}

function startBackendProcess() {
  return new Promise((resolve, reject) => {
    const python = getPythonExecutable();
    const args = [
      '-m',
      'uvicorn',
      'backend.main:app',
      '--host',
      '127.0.0.1',
      '--port',
      String(BACKEND_PORT),
    ];
    if (isDev) {
      args.push('--reload');
    }

    pythonProcess = spawn(python, args, {
      cwd: APP_ROOT,
      env: { ...process.env, PORT: String(BACKEND_PORT) },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    pythonProcess.stdout?.on('data', (chunk) => {
      console.log('[backend]', chunk.toString().trimEnd());
    });
    pythonProcess.stderr?.on('data', (chunk) => {
      console.error('[backend]', chunk.toString().trimEnd());
    });
    pythonProcess.on('error', (err) => {
      pythonProcess = null;
      reject(err);
    });
    pythonProcess.on('exit', (code, signal) => {
      console.log(t('backend_process_exited', { code, signal }));
      pythonProcess = null;
    });

    waitForBackend()
      .then(() => {
        backendStartedByApp = true;
        resolve();
      })
      .catch((err) => {
        stopBackendProcess();
        reject(err);
      });
  });
}

async function ensureBackendRunning() {
  // P0：启动时先清理 8765 所有残留进程，再决定是否拉起新后端
  await cleanupBackendPort(BACKEND_PORT);

  const healthy = await checkBackendHealth();
  const hasRequiredFeatures = healthy && await checkBackendHasRequiredFeatures();
  if (healthy && hasRequiredFeatures) {
    console.log(t('backend_already_running', { url: BACKEND_URL }));
    return;
  }

  console.log(t('backend_starting_uvicorn', { url: BACKEND_URL }));
  await startBackendProcess();
  console.log(t('backend_ready', { url: BACKEND_URL }));
}

function stopBackendProcess() {
  if (pythonProcess && !pythonProcess.killed) {
    const pid = pythonProcess.pid;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/f', '/t'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } else {
      pythonProcess.kill('SIGTERM');
    }
  }
  pythonProcess = null;
  backendStartedByApp = false;
  // P0：退出时清理端口残留（含孤儿子进程）
  cleanupBackendPort(BACKEND_PORT, { delayMs: 0 });
}

function createMainWindow() {
  try {
    const savedBounds = store.get('windowBounds');
    const isMaximized = store.get('isMaximized');
    const bounds = normalizeWindowBounds(savedBounds || defaultWindowBounds);

    const windowOptions = {
      width: bounds.width,
      height: bounds.height,
      minWidth: 800,
      minHeight: 600,
      x: bounds.x,
      y: bounds.y,
      title: 'FindWay Agent',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      },
      show: false,
      backgroundColor: '#f8f9fb'
    };
    const appIcon = resolveAppIcon();
    if (appIcon) {
      windowOptions.icon = appIcon;
    }
    mainWindow = new BrowserWindow(windowOptions);

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) return;
      dialog.showErrorBox(
        '加载失败',
        `无法加载 ${validatedURL}\n${errorDescription} (${errorCode})\n\n请重启应用或检查后端是否在 ${BACKEND_URL} 运行。`
      );
    });

    const loadUrl = isDev ? VITE_DEV_URL : BACKEND_URL;
    mainWindow.loadURL(loadUrl).catch((err) => {
      dialog.showErrorBox(
        '加载失败',
        `${err.message}\n\n请确认 ${isDev ? `Vite 已在 ${VITE_DEV_URL} 运行` : `后端已在 ${BACKEND_URL} 运行`}。`
      );
    });

    mainWindow.once('ready-to-show', () => {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (isMaximized) {
        mainWindow.maximize();
      }
    });

    mainWindow.on('close', (event) => {
      if (!isQuitting && tray) {
        event.preventDefault();
        mainWindow.hide();
        if (tray) {
          const balloon = {
            title: 'FindWay Agent',
            content: '应用已最小化到系统托盘，右键点击托盘图标可退出。'
          };
          const balloonIcon = resolveAppIcon();
          if (balloonIcon) {
            balloon.icon = balloonIcon;
          }
          tray.displayBalloon(balloon);
        }
      }
    });

    mainWindow.on('resize', saveWindowBounds);
    mainWindow.on('move', saveWindowBounds);

    mainWindow.on('maximize', () => {
      store.set('isMaximized', true);
    });

    mainWindow.on('unmaximize', () => {
      store.set('isMaximized', false);
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    console.error('createMainWindow failed:', err);
    dialog.showErrorBox('窗口错误', err.message);
  }
}

function saveWindowBounds() {
  if (mainWindow && !mainWindow.isMaximized()) {
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', bounds);
  }
}

function createTray() {
  try {
    const trayIcon = resolveAppIcon();
    if (!trayIcon) {
      console.warn('No tray icon available, system tray disabled');
      return;
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('FindWay Agent');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('createTray failed:', err);
    tray = null;
  }
}

function setupIPC() {
  ipcMain.on('window-minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (!mainWindow) return;
    if (!isQuitting && tray) {
      mainWindow.hide();
      const balloon = {
        title: 'FindWay Agent',
        content: '应用已最小化到系统托盘，右键点击托盘图标可退出。',
      };
      const balloonIcon = resolveAppIcon();
      if (balloonIcon) balloon.icon = balloonIcon;
      tray.displayBalloon(balloon);
      return;
    }
    mainWindow.close();
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-app-data-path', () => {
    return getFindWayAgentDataDir();
  });

  ipcMain.handle('show-confirm-dialog', async (_event, options = {}) => {
    const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    const result = await dialog.showMessageBox(parent, {
      type: 'question',
      buttons: [options.confirmText || '允许', options.cancelText || '拒绝'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: options.title || '操作确认',
      message: options.message || '',
      detail: options.detail || '',
    });
    return result.response === 0;
  });

  ipcMain.handle('open-path', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: '无效路径' };
    }
    try {
      const result = await shell.openPath(filePath);
      return { success: result === '', error: result || null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.on('send-maximize-change', (event, isMaximized) => {
    if (mainWindow) {
      mainWindow.webContents.send('window-maximize-change', isMaximized);
    }
  });
}

app.whenReady().then(async () => {
  try {
    await ensureBackendRunning();

    const dataDir = getFindWayAgentDataDir();
    console.log(t('electron_data_dir', { path: dataDir }));
    console.log(t('electron_loading', { url: isDev ? VITE_DEV_URL : BACKEND_URL }));
    setupIPC();
    createTray();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else if (mainWindow) {
        mainWindow.show();
      }
    });
  } catch (err) {
    console.error('app.whenReady failed:', err);
    dialog.showErrorBox(
      t('backend_startup_failed_title'),
      t('backend_startup_failed_detail', { error: err.message })
    );
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBackendProcess();
});

app.on('window-all-closed', () => {
  if (isQuitting || tray) return;
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = { ipcMain };
