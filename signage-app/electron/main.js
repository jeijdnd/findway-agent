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

/** 返回可用的托盘/窗口图标；文件不存在时返回 null */
function resolveAppIcon() {
  if (!fs.existsSync(FAVICON_PATH)) {
    return null;
  }
  try {
    const image = nativeImage.createFromPath(FAVICON_PATH);
    return image.isEmpty() ? null : image;
  } catch (err) {
    console.warn('Failed to load favicon:', err.message);
    return null;
  }
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

/** 检查运行中的后端是否包含文件浏览器 API（scan-folder） */
function checkBackendHasFileBrowser() {
  return new Promise((resolve) => {
    const req = http.get(BACKEND_HEALTH_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(Array.isArray(json.features) && json.features.includes('scan-folder'));
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

/** 终止占用指定端口的进程（开发模式清理旧后端） */
function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const pids = new Set();
      for (const line of out.split('\n')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
        } catch {
          // 进程可能已退出
        }
      }
    }
  } catch {
    // 端口无监听进程
  }
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
  const healthy = await checkBackendHealth();
  const hasFileBrowser = healthy && await checkBackendHasFileBrowser();

  // 旧后端进程缺少新 API 时（405 根因），或开发模式需热重载，先清理再启动
  if (healthy && (isDev || !hasFileBrowser)) {
    console.log(t('backend_restarting_stale', { url: BACKEND_URL }) || `Restarting stale backend at ${BACKEND_URL}`);
    killProcessOnPort(BACKEND_PORT);
    await new Promise((r) => setTimeout(r, 800));
  } else if (healthy) {
    console.log(t('backend_already_running', { url: BACKEND_URL }));
    return;
  }

  console.log(t('backend_starting_uvicorn', { url: BACKEND_URL }));
  await startBackendProcess();
  console.log(t('backend_ready', { url: BACKEND_URL }));
}

function stopBackendProcess() {
  if (!backendStartedByApp) {
    return;
  }
  if (!pythonProcess || pythonProcess.killed) {
    pythonProcess = null;
    backendStartedByApp = false;
    return;
  }
  const pid = pythonProcess.pid;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/f', '/t'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  } else {
    pythonProcess.kill('SIGTERM');
  }
  pythonProcess = null;
  backendStartedByApp = false;
}

function createMainWindow() {
  try {
    const savedBounds = store.get('windowBounds');
    const isMaximized = store.get('isMaximized');

    const windowOptions = {
      width: savedBounds.width || 1400,
      height: savedBounds.height || 900,
      minWidth: 800,
      minHeight: 600,
      x: savedBounds.x,
      y: savedBounds.y,
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
      mainWindow.show();
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
      console.warn('favicon.ico not found, system tray disabled');
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
    if (mainWindow) {
      mainWindow.close();
    }
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = { ipcMain };
