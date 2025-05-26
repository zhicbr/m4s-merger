class M4SMerger {
    constructor() {
        this.filePairs = [];
        this.selectedPairs = new Set();
        this.isProcessing = false;
        this.currentProgress = 0;
        this.completedCount = 0;
        this.errorCount = 0;
        this.currentFolderPath = '';
        
        this.initEventListeners();
        this.checkFFmpegAvailability();
    }

    async checkFFmpegAvailability() {
        try {
            const result = await window.electronAPI.checkFFmpeg();
            if (result.success) {
                this.addLog(`FFmpeg检查通过: ${result.version}`, 'success');
            } else {
                this.addLog(`FFmpeg检查失败: ${result.error}`, 'error');
                this.addLog('请确保FFmpeg已安装并添加到系统PATH中', 'warning');
            }
        } catch (error) {
            this.addLog('无法检查FFmpeg状态', 'error');
        }
    }

    initEventListeners() {
        document.getElementById('selectFolder').addEventListener('click', () => this.selectFolder());
        document.getElementById('scanFolder').addEventListener('click', () => this.scanFolder());
        document.getElementById('selectAll').addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
        document.getElementById('startMerge').addEventListener('click', () => this.startMerge());
        document.getElementById('clearSelection').addEventListener('click', () => this.clearSelection());
        document.getElementById('openOutputFolder').addEventListener('click', () => this.openOutputFolder());

        // 监听FFmpeg进度
        window.electronAPI.onFFmpegProgress((event, data) => {
            this.handleFFmpegProgress(data);
        });
    }

    async selectFolder() {
        try {
            const result = await window.electronAPI.selectFolder();
            if (!result.canceled && result.filePaths.length > 0) {
                const folderPath = result.filePaths[0];
                document.getElementById('folderPath').value = folderPath;
                this.currentFolderPath = folderPath;
                document.getElementById('scanFolder').disabled = false;
                this.addLog(`已选择文件夹: ${folderPath}`, 'info');
            }
        } catch (error) {
            this.addLog('选择文件夹失败: ' + error.message, 'error');
        }
    }

    async scanFolder() {
        const folderPath = document.getElementById('folderPath').value.trim();
        if (!folderPath) {
            alert('请先选择文件夹');
            return;
        }

        this.showLoading('scan', true);
        this.addLog('开始扫描文件夹: ' + folderPath, 'info');
        
        try {
            const result = await window.electronAPI.scanFolder(folderPath);
            
            if (result.success) {
                this.filePairs = result.pairs;
                this.currentFolderPath = folderPath;
                this.selectedPairs.clear();
                this.completedCount = 0;
                this.errorCount = 0;
                
                this.updateFileTable();
                this.updateStats();
                
                this.addLog(`扫描完成! 总文件: ${result.totalFiles}, M4S文件: ${result.m4sFiles}, 文件组: ${result.pairs.length}`, 'success');
                
                if (result.pairs.length === 0) {
                    this.addLog('未找到可配对的M4S文件', 'warning');
                }
            } else {
                this.addLog('扫描失败: ' + result.error, 'error');
            }
        } catch (error) {
            this.addLog('扫描出错: ' + error.message, 'error');
        } finally {
            this.showLoading('scan', false);
        }
    }

    updateFileTable() {
        const tbody = document.getElementById('fileTableBody');
        tbody.innerHTML = '';

        this.filePairs.forEach(pair => {
            const row = document.createElement('tr');
            // --- MODIFIKASI: Perbarui kolom output file ---
            row.innerHTML = `
                <td>
                    <div class="checkbox-container">
                        <input type="checkbox" id="checkbox_${pair.id}" class="custom-checkbox"
                               ${pair.status === 'ready' ? '' : 'disabled'}
                               onchange="merger.toggleSelection(${pair.id}, this.checked)">
                    </div>
                </td>
                <td>
                    <span class="status-indicator status-${pair.status}"></span>
                    ${this.getStatusText(pair.status)}
                </td>
                <td><strong>${pair.baseName}</strong></td>
                <td>${pair.hasVideo ? '✅ ' + pair.videoFile : '❌ 缺失'}</td>
                <td>${pair.hasAudio ? '✅ ' + pair.audioFile : '❌ 缺失'}</td>
                <td>${pair.outputExists ? `✅ <b>已存在</b> (${pair.outputFile})` : pair.outputFile}</td>
            `;
            tbody.appendChild(row);
        });

        const container = document.getElementById('fileTableContainer');
        container.classList.remove('hidden');
        container.classList.add('fade-in');

        document.getElementById('openOutputFolder').disabled = false;
    }

    getStatusText(status) {
        const statusMap = {
            'ready': '准备就绪',
            'missing': '文件缺失',
            'processing': '正在处理',
            'completed': '已完成',
            'error': '处理失败'
        };
        return statusMap[status] || status;
    }

    toggleSelection(id, checked) {
        if (checked) {
            this.selectedPairs.add(id);
        } else {
            this.selectedPairs.delete(id);
        }
        this.updateStats();
        this.updateMergeButton();
    }

    toggleSelectAll(checked) {
        const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="checkbox_"]');
        checkboxes.forEach(cb => {
            if (!cb.disabled) {
                cb.checked = checked;
                const id = parseInt(cb.id.split('_')[1]);
                if (checked) {
                    this.selectedPairs.add(id);
                } else {
                    this.selectedPairs.delete(id);
                }
            }
        });
        this.updateStats();
        this.updateMergeButton();
    }

    clearSelection() {
        this.selectedPairs.clear();
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.updateStats();
        this.updateMergeButton();
    }

    updateStats() {
        document.getElementById('totalPairs').textContent = this.filePairs.length;
        document.getElementById('selectedPairs').textContent = this.selectedPairs.size;
        document.getElementById('completedPairs').textContent = this.completedCount;
        document.getElementById('errorPairs').textContent = this.errorCount;
    }

    updateMergeButton() {
        const button = document.getElementById('startMerge');
        button.disabled = this.selectedPairs.size === 0 || this.isProcessing;
    }

    async openOutputFolder() {
        if (this.currentFolderPath) {
            try {
                await window.electronAPI.openFolder(this.currentFolderPath);
            } catch (error) {
                this.addLog('打开文件夹失败: ' + error.message, 'error');
            }
        }
    }

    async startMerge() {
        if (this.selectedPairs.size === 0) {
            alert('请先选择要合并的文件');
            return;
        }

        this.isProcessing = true;
        this.completedCount = 0;
        this.errorCount = 0;
        this.currentProgress = 0;
        
        this.showLoading('merge', true);
        document.getElementById('progressSection').classList.remove('hidden');
        document.getElementById('progressSection').classList.add('fade-in');
        document.getElementById('startMerge').disabled = true;
        
        this.addLog('开始批量合并操作...', 'info');
        
        const selectedFiles = this.filePairs.filter(pair => this.selectedPairs.has(pair.id));
        const total = selectedFiles.length;
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const pair = selectedFiles[i];
            await this.mergeSingleFile(pair, i + 1, total);
        }
        
        this.isProcessing = false;
        this.showLoading('merge', false);
        document.getElementById('startMerge').disabled = false;
        
        const successCount = this.completedCount;
        const failCount = this.errorCount;
        
        if (failCount === 0) {
            this.addLog(`🎉 所有文件合并完成！成功: ${successCount}个`, 'success');
        } else {
            this.addLog(`合并完成！成功: ${successCount}个，失败: ${failCount}个`, 'warning');
        }
        
        this.updateProgress(100, `合并完成 - 成功: ${successCount}, 失败: ${failCount}`);
    }

    async mergeSingleFile(pair, current, total) {
        this.addLog(`[${current}/${total}] 开始处理: ${pair.baseName}`, 'info');
        
        // 更新状态
        pair.status = 'processing';
        this.updateFileTable();
        
        try {
            const result = await window.electronAPI.mergeFile(pair);
            
            if (result.success) {
                pair.status = 'completed';
                this.completedCount++;
                this.addLog(`✅ ${pair.baseName} 合并成功 -> ${pair.outputFile}`, 'success');
            } else {
                pair.status = 'error';
                this.errorCount++;
                this.addLog(`❌ ${pair.baseName} 合并失败: ${result.error}`, 'error');
            }
            
        } catch (error) {
            pair.status = 'error';
            this.errorCount++;
            this.addLog(`❌ ${pair.baseName} 合并异常: ${error.message}`, 'error');
        }
        
        this.updateFileTable();
        this.updateStats();
        
        const progress = (current / total) * 100;
        this.updateProgress(progress, `正在处理 ${current}/${total}: ${pair.baseName}`);
    }

    handleFFmpegProgress(data) {
        const { fileId, output } = data;
        const pair = this.filePairs.find(p => p.id === fileId);
        
        if (pair && output) {
            // 解析FFmpeg输出，提取有用信息
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes('Duration:')) {
                    const duration = line.match(/Duration: (\d{2}:\d{2}:\d{2}\.\d{2})/);
                    if (duration) {
                        this.addLog(`  检测到时长: ${duration[1]}`, 'info');
                    }
                } else if (line.includes('time=')) {
                    const time = line.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
                    if (time) {
                        this.addLog(`  处理进度: ${time[1]}`, 'info');
                    }
                } else if (line.includes('frame=')) {
                    // 限制输出频率，避免日志过多
                    if (Math.random() < 0.1) {
                        const frame = line.match(/frame=\s*(\d+)/);
                        if (frame) {
                            this.addLog(`  已处理帧数: ${frame[1]}`, 'info');
                        }
                    }
                }
            }
        }
    }

    updateProgress(percentage, text) {
        document.getElementById('progressFill').style.width = percentage + '%';
        document.getElementById('progressText').textContent = text;
    }

    showLoading(type, show) {
        const loadingElement = document.getElementById(type + 'Loading');
        if (loadingElement) {
            loadingElement.classList.toggle('hidden', !show);
        }
    }

    addLog(message, type = 'info') {
        const container = document.getElementById('logContainer');
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
        
        // 限制日志条数
        const entries = container.querySelectorAll('.log-entry');
        if (entries.length > 200) {
            entries[0].remove();
        }
    }
}

// 初始化应用
let merger;
document.addEventListener('DOMContentLoaded', () => {
    merger = new M4SMerger();
    
    // 添加初始日志
    merger.addLog('M4S文件合并工具已启动', 'success');
    merger.addLog('请选择包含M4S文件的文件夹开始使用', 'info');
});