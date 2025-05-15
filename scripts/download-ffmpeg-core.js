// maotoumao-musicfreedesktop/scripts/download-ffmpeg-core.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// 从 package.json 读取 @ffmpeg/core 的版本
let coreVersion = '0.12.6'; // 默认值
try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));
    const coreDepVersion = pkg.dependencies['@ffmpeg/core'];
    if (coreDepVersion) {
        coreVersion = coreDepVersion.replace('^', '').replace('~', '');
    }
} catch (e) {
    console.warn("Could not read @ffmpeg/core version from package.json, using default:", coreVersion, e);
}

const baseUrl = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm/`;
// 注意：v0.12.x 的 esm 产物可能不包含 worker，多线程版本需要 @ffmpeg/core-mt
// 我们这里先用单线程，所以不需要 worker.js
const filesToDownload = [
    'ffmpeg-core.js',
    'ffmpeg-core.wasm',
];
const destDir = path.resolve(__dirname, '../res/ffmpeg-core');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

console.log(`Using @ffmpeg/core version: ${coreVersion}`);
console.log(`FFmpeg core base URL: ${baseUrl}`);

filesToDownload.forEach(file => {
    const fileUrl = baseUrl + file;
    const destPath = path.join(destDir, file);

    if (fs.existsSync(destPath)) {
        console.log(`[FFmpeg Core] ${file} already exists. Skipping download.`);
        return;
    }

    console.log(`[FFmpeg Core] Downloading ${fileUrl} to ${destPath}...`);
    try {
        // 使用 curl 或 wget 进行同步下载，更简单可靠
        // 注意：这需要系统中安装了 curl 或 wget
        if (process.platform === 'win32') {
            // Windows 可能没有 curl,尝试 powershell
            execSync(`powershell -Command "Invoke-WebRequest -Uri ${fileUrl} -OutFile ${destPath}"`, { stdio: 'inherit' });
        } else {
            execSync(`curl -L -o "${destPath}" "${fileUrl}"`, { stdio: 'inherit' });
        }
        console.log(`[FFmpeg Core] ${file} downloaded successfully.`);
    } catch (error) {
        console.error(`[FFmpeg Core] Error downloading ${file}: ${error.message}`);
        if (fs.existsSync(destPath)) {
            fs.unlinkSync(destPath); // Delete the file if download failed
        }
        process.exit(1); // 下载失败则退出
    }
});

console.log('[FFmpeg Core] All necessary files checked/downloaded.');