const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露安全的API
contextBridge.exposeInMainWorld('electronAPI', {
    // 选择文件夹
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    
    // 扫描文件夹
    scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
    
    // 合并文件
    mergeFile: (filePair) => ipcRenderer.invoke('merge-file', filePair),
    
    // 打开文件夹
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
    
    // 检查FFmpeg
    checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
    
    // 获取上次打开的文件夹路径
    getLastFolder: () => ipcRenderer.invoke('get-last-folder'),
    
    // 保存上次打开的文件夹路径
    saveLastFolder: (folderPath) => ipcRenderer.invoke('save-last-folder', folderPath),
    
    // 监听FFmpeg进度
    onFFmpegProgress: (callback) => {
        ipcRenderer.on('ffmpeg-progress', callback);
    },
    
    // 移除FFmpeg进度监听器
    removeFFmpegProgressListener: () => {
        ipcRenderer.removeAllListeners('ffmpeg-progress');
    }
});