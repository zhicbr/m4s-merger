const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const { existsSync, writeFileSync, readFileSync } = require('fs');

// 存储上次打开的文件夹路径的文件
const LAST_FOLDER_FILE = path.join(app.getPath('userData'), 'last_folder.json');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'), // 可选：添加应用图标
        show: false
    });

    mainWindow.loadFile('index.html');

    // 窗口准备好后显示
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // 开发环境下打开开发者工具
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(createWindow);

// 获取上次打开的文件夹路径
ipcMain.handle('get-last-folder', async () => {
    try {
        if (existsSync(LAST_FOLDER_FILE)) {
            const data = readFileSync(LAST_FOLDER_FILE, 'utf8');
            const { lastFolder } = JSON.parse(data);
            return { success: true, lastFolder };
        }
        return { success: false };
    } catch (error) {
        console.error('读取上次文件夹路径失败:', error);
        return { success: false, error: error.message };
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC处理程序

// 选择文件夹
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: '选择包含M4S文件的文件夹'
    });
    
    // 如果用户选择了文件夹，保存路径
    if (!result.canceled && result.filePaths.length > 0) {
        try {
            const folderPath = result.filePaths[0];
            writeFileSync(LAST_FOLDER_FILE, JSON.stringify({ lastFolder: folderPath }));
        } catch (error) {
            console.error('保存文件夹路径失败:', error);
        }
    }
    
    return result;
});

// 保存上次打开的文件夹路径
ipcMain.handle('save-last-folder', async (event, folderPath) => {
    try {
        writeFileSync(LAST_FOLDER_FILE, JSON.stringify({ lastFolder: folderPath }));
        return { success: true };
    } catch (error) {
        console.error('保存文件夹路径失败:', error);
        return { success: false, error: error.message };
    }
});

// 扫描文件夹
// 修改后的 main.js 扫描逻辑
// 扫描文件夹（优化后的兼容性递归版本）
ipcMain.handle('scan-folder', async (event, folderPath) => {
    try {
        const { join, relative } = require('path');
        const { readdir, stat } = require('fs').promises;

        // 递归获取所有文件的函数
        async function getAllFiles(dirPath, arrayOfFiles = []) {
            const files = await readdir(dirPath, { withFileTypes: true });

            for (const file of files) {
                const fullPath = join(dirPath, file.name);
                if (file.isDirectory()) {
                    await getAllFiles(fullPath, arrayOfFiles);
                } else {
                    arrayOfFiles.push({
                        fullPath: fullPath,
                        name: file.name,
                        dir: dirPath
                    });
                }
            }
            return arrayOfFiles;
        }

        const allFiles = await getAllFiles(folderPath);
        
        const m4sFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.m4s'));
        const mp4FilesSet = new Set(
            allFiles.filter(f => f.name.toLowerCase().endsWith('.mp4')).map(f => f.fullPath)
        );

        const filePairs = [];
        const processedPaths = new Set();

        for (const fileObj of m4sFiles) {
            if (processedPaths.has(fileObj.fullPath)) continue;

            // 提取基础名
            const baseName = fileObj.name.replace(/_audio\.m4s$|\.m4s$/i, '');
            const dir = fileObj.dir;
            
            // 构建同一目录下的对应文件
            const videoPath = join(dir, `${baseName}.m4s`);
            const audioPath = join(dir, `${baseName}_audio.m4s`);
            const outputPath = join(dir, `${baseName}.mp4`);

            const hasVideo = m4sFiles.some(f => f.fullPath === videoPath);
            const hasAudio = m4sFiles.some(f => f.fullPath === audioPath);
            const outputExists = mp4FilesSet.has(outputPath);

            if (hasVideo || hasAudio) {
                filePairs.push({
                    id: filePairs.length + 1,
                    baseName: baseName,
                    // 存储绝对路径，避免合并时找不到文件
                    videoFile: hasVideo ? videoPath : null,
                    audioFile: hasAudio ? audioPath : null,
                    // 存储相对路径，用于在界面展示，让用户知道在哪个子文件夹
                    videoRel: hasVideo ? relative(folderPath, videoPath) : '缺失',
                    audioRel: hasAudio ? relative(folderPath, audioPath) : '缺失',
                    outputFile: outputPath,
                    outputRel: relative(folderPath, outputPath),
                    outputExists: outputExists,
                    status: (hasVideo && hasAudio) ? 'ready' : 'missing',
                    hasVideo: hasVideo,
                    hasAudio: hasAudio,
                    folderPath: dir 
                });

                processedPaths.add(videoPath);
                processedPaths.add(audioPath);
            }
        }

        return {
            success: true,
            pairs: filePairs,
            totalFiles: allFiles.length
        };
    } catch (error) {
        console.error('扫描失败:', error);
        return { success: false, error: error.message };
    }
});
// 合并单个文件
// 合并单个文件（适配绝对路径版本）
ipcMain.handle('merge-file', async (event, filePair) => {
    return new Promise((resolve) => {
        try {
            // 注意：此时的 videoFile, audioFile, outputFile 已经是全路径了
            const { videoFile, audioFile, outputFile } = filePair;
            
            if (!videoFile || !audioFile) {
                throw new Error('音视频文件路径不完整');
            }

            console.log('开始合并:', { videoFile, audioFile, outputFile });

            const args = [
                '-i', videoFile,
                '-i', audioFile,
                '-c', 'copy',
                '-y',
                outputFile
            ];

            const ffmpeg = spawn('ffmpeg', args);
            let errorOutput = '';

            ffmpeg.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                event.sender.send('ffmpeg-progress', {
                    fileId: filePair.id,
                    output: text
                });
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, outputPath: outputFile });
                } else {
                    resolve({ success: false, error: `FFmpeg退出码: ${code}`, output: errorOutput });
                }
            });

            ffmpeg.on('error', (error) => {
                resolve({ 
                    success: false, 
                    error: error.message.includes('ENOENT') ? 'FFmpeg未安装' : error.message 
                });
            });

        } catch (error) {
            resolve({ success: false, error: error.message });
        }
    });
});
// 打开文件夹
ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
        await shell.openPath(folderPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 检查FFmpeg是否可用
ipcMain.handle('check-ffmpeg', async () => {
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', ['-version']);
        
        let output = '';
        ffmpeg.stdout.on('data', (data) => {
            output += data.toString();
        });

        ffmpeg.stderr.on('data', (data) => {
            output += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0 || output.includes('ffmpeg version')) {
                resolve({ 
                    success: true, 
                    version: output.split('\n')[0] 
                });
            } else {
                resolve({ 
                    success: false, 
                    error: 'FFmpeg不可用' 
                });
            }
        });

        ffmpeg.on('error', (error) => {
            resolve({ 
                success: false, 
                error: 'FFmpeg未安装或不在系统PATH中' 
            });
        });
    });
});