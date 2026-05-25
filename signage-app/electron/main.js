/**
 * FindWay Agent Electron 主进程
 * 负责创建窗口、管理生命周期、启动Python后端
 */
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const defaultWindowBounds = { x: undefined, y: undefined, width: 1400, height: 900 };
let store;

// 初始化 electron-store；缺失依赖时使用内存回退，避免启动即崩溃
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

// 全局变量
let mainWindow = null; // 主窗口实例
let tray = null; // 系统托盘实例
let pythonProcess = null; // Python后端进程
let isQuitting = false; // 是否正在退出应用

// 开发模式判断：环境变量 NODE_ENV 不是 'production' 则为开发模式
const isDev = process.env.NODE_ENV !== 'production';

/**
 * 启动Python后端服务
 * 使用child_process.spawn启动python backend/main.py
 * 环境变量PORT=8765
 */
function startPythonBackend() {
  try {
    console.log('正在启动Python后端服务...');

    // 确定Python解释器路径（优先使用虚拟环境）
    const venvPath = path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe');
    const pythonPath = fs.existsSync(venvPath) ? venvPath : 'python';

    // 启动参数
    const args = ['backend/main.py'];
    const options = {
      cwd: path.join(__dirname, '..'), // 工作目录为signage-app
      env: {
        ...process.env,
        PORT: '8765', // 设置后端端口环境变量
        PYTHONPATH: path.join(__dirname, '..')
      },
      stdio: 'pipe' // 捕获输出
    };

    // 启动Python进程
    pythonProcess = spawn(pythonPath, args, options);

    // 监听标准输出
    pythonProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.log(`[Python后端] ${message}`);
      }
    });

    // 监听标准错误
    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.error(`[Python后端错误] ${message}`);
      }
    });

    // 监听进程退出
    pythonProcess.on('close', (code) => {
      console.log(`Python后端进程退出，退出码: ${code}`);
      pythonProcess = null;
    });

    // 监听进程错误
    pythonProcess.on('error', (err) => {
      console.error('启动Python后端失败:', err);
      pythonProcess = null;
      dialog.showErrorBox(
        '后端启动失败',
        `无法启动 Python 后端：${err.message}\n\n请检查 Python 是否已安装，并运行 install.bat 创建虚拟环境。`
      );
    });
  } catch (err) {
    console.error('startPythonBackend failed:', err);
    dialog.showErrorBox(
      '后端启动失败',
      `无法启动 Python 后端：${err.message}\n\n请检查 Python 是否已安装，并运行 install.bat 创建虚拟环境。`
    );
  }
}

/**
 * 停止Python后端服务
 * 向Python进程发送SIGTERM信号，如果3秒内未退出则强制终止
 */
function stopPythonBackend() {
  if (pythonProcess) {
    console.log('正在停止Python后端服务...');
    
    // 尝试优雅关闭
    pythonProcess.kill('SIGTERM');
    
    // 设置超时，如果3秒后进程仍在运行则强制终止
    const killTimeout = setTimeout(() => {
      if (pythonProcess) {
        console.log('Python后端未响应，强制终止...');
        pythonProcess.kill('SIGKILL');
      }
    }, 3000);
    
    // 监听进程关闭事件，清除超时
    pythonProcess.on('close', () => {
      clearTimeout(killTimeout);
    });
  }
}

const BACKEND_HEALTH_URL = 'http://127.0.0.1:8765/api/health';
const BACKEND_WAIT_TIMEOUT_MS = 60000;
const BACKEND_POLL_INTERVAL_MS = 500;

/**
 * HTTP 健康检查：GET /api/health，响应 body 含 status:"ok" 才算就绪
 * @returns {Promise<boolean>}
 */
async function checkBackendHealth() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(BACKEND_HEALTH_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return false;

    const text = await response.text();
    const data = JSON.parse(text);
    return data && data.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 等待 Python 后端启动（轮询 HTTP 健康检查，不只看进程是否存活）
 * @returns {Promise<{ ready: boolean, reason?: 'timeout' | 'exited' }>}
 */
async function waitForPythonBackend() {
  const maxAttempts = Math.ceil(BACKEND_WAIT_TIMEOUT_MS / BACKEND_POLL_INTERVAL_MS);
  const waitSeconds = BACKEND_WAIT_TIMEOUT_MS / 1000;

  console.log(`等待 Python 后端就绪（轮询 ${BACKEND_HEALTH_URL}，最长 ${waitSeconds} 秒）...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (!pythonProcess) {
      console.error('Python 后端进程已退出，健康检查中止');
      return { ready: false, reason: 'exited' };
    }

    const healthy = await checkBackendHealth();
    if (healthy) {
      console.log(`Python 后端就绪（第 ${attempt}/${maxAttempts} 次检查）`);
      return { ready: true };
    }

    if (attempt % 10 === 0) {
      console.log(`后端启动中...（${attempt}/${maxAttempts}，已等待约 ${Math.round(attempt * BACKEND_POLL_INTERVAL_MS / 1000)} 秒）`);
    }

    await new Promise((resolve) => setTimeout(resolve, BACKEND_POLL_INTERVAL_MS));
  }

  console.error(`Python 后端健康检查超时（${waitSeconds} 秒）`);
  return { ready: false, reason: 'timeout' };
}

/**
 * 创建主窗口
 */
function createMainWindow() {
  try {
    // 获取之前保存的窗口位置和大小
    const savedBounds = store.get('windowBounds');
    const isMaximized = store.get('isMaximized');

    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
      width: savedBounds.width || 1400,
      height: savedBounds.height || 900,
      minWidth: 800,
      minHeight: 600,
      x: savedBounds.x,
      y: savedBounds.y,
      title: 'FindWay Agent',
      icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.ico'), // 应用图标
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'), // 预加载脚本
        nodeIntegration: false, // 禁用Node集成
        contextIsolation: true, // 启用上下文隔离
        sandbox: false // 禁用沙箱以允许preload脚本访问Node API
      },
      show: false, // 先隐藏窗口，准备好后再显示
      backgroundColor: '#f8f9fb' // 背景色，避免白屏闪烁
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) return; // 导航取消，忽略
      dialog.showErrorBox(
        'Load Error',
        `Failed to load ${validatedURL}\n${errorDescription} (${errorCode})`
      );
    });

    // 根据开发模式加载不同URL
    const loadUrl = isDev ? 'http://localhost:5173' : 'http://127.0.0.1:8765';
    mainWindow.loadURL(loadUrl).catch((err) => {
      dialog.showErrorBox('Load Error', err.message);
    });

    if (isDev) {
      // 开发模式下打开开发者工具
      mainWindow.webContents.openDevTools();
    }

    // 窗口准备好后显示
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();

      // 如果之前是最大化状态，则最大化窗口
      if (isMaximized) {
        mainWindow.maximize();
      }
    });

    // 窗口关闭事件：隐藏到托盘而不是退出
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        // 阻止默认关闭行为
        event.preventDefault();
        // 隐藏窗口
        mainWindow.hide();
        // 显示托盘气泡提示
        if (tray) {
          tray.displayBalloon({
            title: 'FindWay Agent',
            content: '应用已最小化到系统托盘，右键点击托盘图标可退出。',
            icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.ico')
          });
        }
      }
    });

    // 保存窗口位置和大小
    mainWindow.on('resize', saveWindowBounds);
    mainWindow.on('move', saveWindowBounds);

    // 窗口最大化/取消最大化事件
    mainWindow.on('maximize', () => {
      store.set('isMaximized', true);
    });

    mainWindow.on('unmaximize', () => {
      store.set('isMaximized', false);
    });

    // 窗口关闭后清理引用
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    console.error('createMainWindow failed:', err);
    dialog.showErrorBox('Window Error', err.message);
  }
}

/**
 * 保存窗口位置和大小到electron-store
 */
function saveWindowBounds() {
  if (mainWindow && !mainWindow.isMaximized()) {
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', bounds);
  }
}

/**
 * 创建系统托盘
 */
function createTray() {
  // 托盘图标路径
  const iconPath = path.join(__dirname, '..', 'frontend', 'public', 'favicon.ico');
  
  // 创建托盘图标
  tray = new Tray(iconPath);
  
  // 设置托盘图标提示
  tray.setToolTip('FindWay Agent');
  
  // 创建右键菜单
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
  
  // 设置托盘右键菜单
  tray.setContextMenu(contextMenu);
  
  // 双击托盘图标显示主窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * 设置IPC事件处理程序
 * 处理来自渲染进程的IPC消息
 */
function setupIPC() {
  // 窗口最小化
  ipcMain.on('window-minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });
  
  // 窗口最大化/还原
  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });
  
  // 关闭窗口
  ipcMain.on('window-close', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });
  
  // 获取应用版本号
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
  
  // 发送Python后端状态到渲染进程
  ipcMain.on('send-python-status', (event, status) => {
    if (mainWindow) {
      mainWindow.webContents.send('python-status', status);
    }
  });
  
  // 发送窗口最大化状态变化到渲染进程
  ipcMain.on('send-maximize-change', (event, isMaximized) => {
    if (mainWindow) {
      mainWindow.webContents.send('window-maximize-change', isMaximized);
    }
  });
}

/**
 * 应用准备就绪
 */
app.whenReady().then(async () => {
  try {
    console.log('FindWay Agent Electron 应用启动...');

    // 启动Python后端
    startPythonBackend();

    // 等待 Python 后端 HTTP 健康检查通过
    const backendResult = await waitForPythonBackend();

    if (!backendResult.ready) {
      const isTimeout = backendResult.reason === 'timeout';
      const result = dialog.showMessageBoxSync({
        type: isTimeout ? 'warning' : 'error',
        title: isTimeout ? '后端启动较慢' : '后端启动失败',
        message: isTimeout
          ? '后端启动较慢，请重试'
          : 'Python 后端进程已退出',
        detail: isTimeout
          ? `在 ${BACKEND_WAIT_TIMEOUT_MS / 1000} 秒内无法访问 ${BACKEND_HEALTH_URL}（期望 {"status":"ok"}）。\n\n可能原因：\n1. 首次启动较慢，请再试一次\n2. 请先运行 install.bat 创建虚拟环境\n3. 端口 8765 被占用`
          : `Python 进程在健康检查完成前已退出。\n\n请检查：\n1. Python 是否已安装\n2. 运行 install.bat 创建 venv\n3. 查看控制台中的 [Python后端错误] 日志`,
        buttons: ['退出', '重试'],
        defaultId: 1,
        cancelId: 0
      });

      if (result === 1) {
        app.relaunch();
      }

      app.quit();
      return;
    }

    // 设置IPC事件处理程序
    setupIPC();

    // 创建系统托盘
    createTray();

    // 创建主窗口
    createMainWindow();

    // macOS激活事件：点击dock图标时重新创建窗口
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else if (mainWindow) {
        mainWindow.show();
      }
    });
  } catch (err) {
    console.error('app.whenReady failed:', err);
    dialog.showErrorBox('Startup Error', err.message);
  }
});

/**
 * 应用退出前清理
 */
app.on('before-quit', () => {
  console.log('FindWay Agent 正在退出...');
  isQuitting = true;
  
  // 停止Python后端
  stopPythonBackend();
});

/**
 * 所有窗口关闭后退出应用（Windows/Linux）
 * macOS除外，因为macOS应用通常保持运行直到Cmd+Q
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 导出ipcMain供preload.js使用
module.exports = { ipcMain };