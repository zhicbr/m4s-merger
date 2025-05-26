M4S文件合并工具
🎬 一个基于Electron的图形化M4S视频音频文件合并工具，简化FFmpeg批量处理操作。

✨ 功能特性
🗂️ 智能文件扫描 - 自动识别M4S视频和音频文件对
📋 批量选择管理 - 支持单选、多选和全选操作
⚡ 并行合并处理 - 高效批量处理多个文件组
📊 实时进度显示 - 详细的进度条和日志输出
🎨 现代化界面 - 美观直观的用户体验
🔄 智能状态管理 - 实时显示文件状态和处理结果
📋 系统要求
必需组件
Node.js 16.0.0 或更高版本
FFmpeg - 视频处理核心组件
Windows 10/11 （推荐）或 macOS/Linux
文件格式
支持 .m4s 格式的视频和音频文件
自动识别 filename.m4s 和 filename_audio.m4s 的配对关系
输出为 .mp4 格式
🚀 快速开始
方式1: 一键安装（推荐）
下载项目文件到本地
双击 start.bat 启动程序
方式2: 手动安装
bash

# 1. 克隆或下载项目
git clone <your-repo-url>
cd m4s-merger

# 2. 安装依赖
npm install

# 3. 启动程序
npm start
📖 使用说明
1. 选择文件夹
点击"选择文件夹"按钮或手动输入路径
选择包含M4S文件的文件夹
2. 扫描文件
点击"扫描文件"按钮
系统会自动识别视频音频文件对
查看扫描结果统计
3. 选择文件
在表格中勾选要合并的文件组
支持"全选"和"清除选择"操作
只有状态为"准备就绪"的文件可被选择
4. 开始合并
点击"开始合并选中文件"
实时查看合并进度和日志
合并完成后可打开输出文件
🔧 FFmpeg安装指南
Windows系统
方式1: 使用Chocolatey（推荐）
powershell
# 以管理员身份运行PowerShell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 安装FFmpeg
choco install ffmpeg
方式2: 手动安装
访问 FFmpeg官网
下载Windows版本的静态构建
解压到 C:\ffmpeg
将 C:\ffmpeg\bin 添加到系统PATH环境变量
macOS系统
bash
# 使用Homebrew
brew install ffmpeg
Linux系统
bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg
📁 项目结构
m4s-merger/
├── main.js           # Electron主进程
├── preload.js        # 预加载脚本
├── renderer.js       # 渲染进程逻辑
├── index.html        # 主界面
├── package.json      # 项目配置
├── start.bat         # 快速启动脚本
├── install.bat       # 一键安装脚本
├── assets/           # 资源文件
│   ├── icon.png
│   ├── icon.ico
│   └── icon.icns
└── README.md         # 项目说明
🛠️ 开发说明
开发模式启动
bash
npm run dev
构建应用
bash
# 构建所有平台
npm run build

# 构建特定平台
npm run build-win    # Windows
npm run build-mac    # macOS
npm run build-linux  # Linux
调试模式
开发模式会自动打开开发者工具
可以在控制台查看详细日志
⚠️ 注意事项
FFmpeg依赖: 程序依赖FFmpeg进行视频处理，请确保正确安装
文件路径: 避免路径中包含特殊字符或中文字符
磁盘空间: 确保有足够的磁盘空间存储输出文件
文件权限: 确保对目标文件夹有读写权限
🐛 常见问题
Q: 提示"FFmpeg未安装或不在系统PATH中"
A: 请按照上述FFmpeg安装指南正确安装并配置环境变量

Q: 合并失败，提示权限错误
A: 确保对目标文件夹有写入权限，或以管理员身份运行程序

Q: 扫描不到M4S文件
A: 确认文件扩展名为.m4s，且文件名格式符合name.m4s和name_audio.m4s的配对规则



📝 更新日志
v1.0.0
🎉 初始版本发布
✅ 基础文件扫描和合并功能
✅ 图形化用户界面
✅ 批量处理支持
✅ 实时进度显示🤝 贡献
欢迎提交Issue和Pull Request来改进这个项目！


TODO 进行如下三个修改：如果已经有同名mp4文件，则在扫描出来后，输出文件里显示已经有同名文件。每次记住上一次使用时打开的文件夹。扫描文件按钮和开始合并选中文件按钮里那个转圈的动画删掉，其他东西不变。