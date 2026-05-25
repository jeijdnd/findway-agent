/**
 * FindWay Agent Electron 主进程
 * 仅负责窗口与 UI；后端由 desktop.bat 启动
 */
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain } = require('electron');
const path = require('path');

const BACKEND_URL = 'http://127.0.0.1:8765';
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

function createMainWindow() {
  try {
    const savedBounds = store.get('windowBounds');
    const isMaximized = store.get('isMaximized');

    mainWindow = new BrowserWindow({
      width: savedBounds.width || 1400,
      height: savedBounds.height || 900,
      minWidth: 800,
      minHeight: 600,
      x: savedBounds.x,
      y: savedBounds.y,
      title: 'FindWay Agent',
      icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      },
      show: false,
      backgroundColor: '#f8f9fb'
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) return;
      dialog.showErrorBox(
        '加载失败',
        `无法加载 ${validatedURL}\n${errorDescription} (${errorCode})\n\n请先运行 desktop.bat 启动后端。`
      );
    });

    mainWindow.loadURL(BACKEND_URL).catch((err) => {
      dialog.showErrorBox(
        '加载失败',
        `${err.message}\n\n请确认后端已在 http://127.0.0.1:8765 运行（运行 desktop.bat）。`
      );
    });

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      if (isMaximized) {
        mainWindow.maximize();
      }
    });

    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
        if (tray) {
          tray.displayBalloon({
            title: 'FindWay Agent',
            content: '应用已最小化到系统托盘，右键点击托盘图标可退出。',
            icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.ico')
          });
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
  const iconPath = path.join(__dirname, '..', 'frontend', 'public', 'favicon.ico');
  tray = new Tray(iconPath);
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

  ipcMain.on('send-maximize-change', (event, isMaximized) => {
    if (mainWindow) {
      mainWindow.webContents.send('window-maximize-change', isMaximized);
    }
  });
}

app.whenReady().then(() => {
  try {
    console.log('FindWay Agent Electron 启动，加载', BACKEND_URL);
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
    dialog.showErrorBox('启动错误', err.message);
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = { ipcMain };
