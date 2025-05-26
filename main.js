const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

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
    
    return result;
});

// 扫描文件夹
ipcMain.handle('scan-folder', async (event, folderPath) => {
    try {
        console.log('开始扫描文件夹:', folderPath);

        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) {
            throw new Error('指定路径不是文件夹');
        }

        const files = await fs.readdir(folderPath);
        console.log('找到文件:', files.length, '个');

        const m4sFiles = files.filter(file => file.toLowerCase().endsWith('.m4s'));
        // --- BARU: Buat Set file MP4 untuk pencarian cepat ---
        const mp4Files = new Set(files.filter(file => file.toLowerCase().endsWith('.mp4')));
        console.log('M4S文件:', m4sFiles);

        const filePairs = [];
        const processedFiles = new Set();

        for (const file of m4sFiles) {
            if (processedFiles.has(file)) continue;

            const baseName = file.replace(/_audio\.m4s$|\.m4s$/i, '');
            const videoFile = `${baseName}.m4s`;
            const audioFile = `${baseName}_audio.m4s`;
            const outputFile = `${baseName}.mp4`; // Nama file output

            const hasVideo = m4sFiles.includes(videoFile);
            const hasAudio = m4sFiles.includes(audioFile);
            // --- BARU: Periksa apakah file MP4 output sudah ada ---
            const outputExists = mp4Files.has(outputFile);

            if (hasVideo || hasAudio) {
                filePairs.push({
                    id: filePairs.length + 1,
                    baseName: baseName,
                    videoFile: hasVideo ? videoFile : null,
                    audioFile: hasAudio ? audioFile : null,
                    outputFile: outputFile,
                    // --- BARU: Tambahkan flag outputExists ---
                    outputExists: outputExists,
                    status: (hasVideo && hasAudio) ? 'ready' : 'missing',
                    hasVideo: hasVideo,
                    hasAudio: hasAudio,
                    folderPath: folderPath
                });

                processedFiles.add(videoFile);
                processedFiles.add(audioFile);
            }
        }

        console.log('找到文件对:', filePairs.length, '组');
        return {
            success: true,
            pairs: filePairs,
            totalFiles: files.length,
            m4sFiles: m4sFiles.length
        };

    } catch (error) {
        console.error('扫描文件夹出错:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
// 合并单个文件
ipcMain.handle('merge-file', async (event, filePair) => {
    return new Promise((resolve) => {
        try {
            const { folderPath, videoFile, audioFile, outputFile } = filePair;
            
            const videoPath = path.join(folderPath, videoFile);
            const audioPath = path.join(folderPath, audioFile);
            const outputPath = path.join(folderPath, outputFile);

            console.log('开始合并:', {
                video: videoPath,
                audio: audioPath,
                output: outputPath
            });

            // 构建FFmpeg命令
            const args = [
                '-i', videoPath,
                '-i', audioPath,
                '-c', 'copy',
                '-y', // 覆盖输出文件
                outputPath
            ];

            const ffmpeg = spawn('ffmpeg', args);
            let output = '';
            let errorOutput = '';

            // 捕获标准输出
            ffmpeg.stdout.on('data', (data) => {
                output += data.toString();
            });

            // 捕获错误输出（FFmpeg主要信息在stderr中）
            ffmpeg.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                
                // 发送实时进度信息到渲染进程
                event.sender.send('ffmpeg-progress', {
                    fileId: filePair.id,
                    output: text
                });
            });

            ffmpeg.on('close', (code) => {
                console.log(`FFmpeg进程结束，退出码: ${code}`);
                
                if (code === 0) {
                    resolve({
                        success: true,
                        output: errorOutput,
                        outputPath: outputPath
                    });
                } else {
                    resolve({
                        success: false,
                        error: `FFmpeg退出码: ${code}`,
                        output: errorOutput
                    });
                }
            });

            ffmpeg.on('error', (error) => {
                console.error('FFmpeg启动失败:', error);
                resolve({
                    success: false,
                    error: error.message.includes('ENOENT') 
                        ? 'FFmpeg未安装或不在系统PATH中' 
                        : error.message
                });
            });

        } catch (error) {
            console.error('合并文件出错:', error);
            resolve({
                success: false,
                error: error.message
            });
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