/**
 * Electron 预加载脚本
 * 在渲染进程中暴露安全的API，用于与主进程通信
 */
const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 最小化窗口
   */
  minimizeWindow: () => {
    ipcRenderer.send('window-minimize');
  },
  
  /**
   * 最大化/还原窗口
   */
  maximizeWindow: () => {
    ipcRenderer.send('window-maximize');
  },
  
  /**
   * 关闭窗口
   */
  closeWindow: () => {
    ipcRenderer.send('window-close');
  },
  
  /**
   * 获取应用版本号
   * @returns {Promise<string>} 应用版本号
   */
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },
  
  /**
   * 监听Python后端状态
   * @param {Function} callback - 回调函数，接收状态对象
   */
  onPythonStatus: (callback) => {
    ipcRenderer.on('python-status', (event, status) => {
      callback(status);
    });
  },
  
  /**
   * 监听窗口最大化状态变化
   * @param {Function} callback - 回调函数，接收是否最大化
   */
  onMaximizeChange: (callback) => {
    ipcRenderer.on('window-maximize-change', (event, isMaximized) => {
      callback(isMaximized);
    });
  }
});