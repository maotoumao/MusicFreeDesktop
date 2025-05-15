import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { getGlobalContext } from '@/shared/global-context/renderer';
import { fsUtil } from '@/shared/utils/renderer'; // 确保 preload 中暴露了 fs
import logger from '@/shared/logger/renderer';

class FFmpegService {
    private ffmpeg: FFmpeg | null = null;
    private loadingPromise: Promise<void> | null = null;
    private corePath: string;

    constructor() {
        const globalContext = getGlobalContext();
        if (!globalContext || !globalContext.appPath || !globalContext.appPath.res) {
            const errMsg = "FFmpegService: Global context or appPath.res is not available.";
            logger.logError(errMsg, new Error(errMsg));
            throw new Error(errMsg);
        }
        // 在 Electron 中，extraResource 打包后的路径通常在 process.resourcesPath 下
        // getGlobalContext().appPath.res 应该指向这个目录
        this.corePath = window.path.join(globalContext.appPath.res, 'ffmpeg-core');
    }

    private async getBlobUrlForLocalFile(filePath: string, mimeType: string): Promise<string> {
        try {
            const fileContent = await fsUtil.readFile(filePath); // fsUtil.readFile 应该返回 Buffer 或 Uint8Array
            const blob = new Blob([fileContent], { type: mimeType });
            return URL.createObjectURL(blob);
        } catch (error) {
            logger.logError(`Failed to create blob URL for ${filePath}`, error as Error);
            throw error;
        }
    }

    public async load(): Promise<void> {
        if (this.ffmpeg && this.ffmpeg.loaded) {
            return Promise.resolve();
        }
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = new Promise(async (resolve, reject) => {
            try {
                logger.logInfo('[FFmpeg] Loading FFmpeg...');
                this.ffmpeg = new FFmpeg();
                this.ffmpeg.on('log', ({ message }) => {
                    // 可以根据需要过滤或格式化日志
                    if (message.includes('Input #') || message.includes('Output #') || message.includes('Stream mapping') || message.includes('frame=')) {
                        // 忽略一些不必要的详细日志
                        return;
                    }
                    logger.logInfo('[FFmpeg Log]', message);
                });
                 this.ffmpeg.on('progress', ({ progress, time }) => {
                     logger.logInfo('[FFmpeg Progress]', { progress: (progress * 100).toFixed(2) + '%', time});
                 });

                const coreURL = await this.getBlobUrlForLocalFile(window.path.join(this.corePath, 'ffmpeg-core.js'), 'text/javascript');
                const wasmURL = await this.getBlobUrlForLocalFile(window.path.join(this.corePath, 'ffmpeg-core.wasm'), 'application/wasm');
                // 对于单线程版本，不需要 workerURL
                
                await this.ffmpeg.load({ coreURL, wasmURL });
                logger.logInfo('[FFmpeg] FFmpeg loaded successfully.');
                resolve();
            } catch (error) {
                logger.logError("Failed to load FFmpeg", error as Error);
                this.loadingPromise = null;
                this.ffmpeg = null;
                reject(error);
            }
        });
        return this.loadingPromise;
    }

    public async transcodeToWav(inputFile: string | File | Blob | Uint8Array, inputFileNameOverride?: string): Promise<Blob | null> {
        if (!this.ffmpeg || !this.ffmpeg.loaded) {
            await this.load();
        }
        if (!this.ffmpeg) {
            logger.logError('FFmpeg not loaded, cannot transcode.', new Error('FFmpeg not loaded'));
            return null;
        }

        const inputFileName = inputFileNameOverride || (typeof inputFile === 'string' ? window.path.basename(inputFile) : (inputFile instanceof File ? inputFile.name : `input.${Date.now()}`));
        const outputFileName = `output-${Date.now()}.wav`;
        logger.logInfo(`[FFmpeg] Starting transcoding: ${inputFileName} to ${outputFileName}`);

        try {
            let dataToProcess: Uint8Array;
            if (inputFile instanceof Uint8Array) {
                dataToProcess = inputFile;
            } else if (typeof inputFile === 'string') { // 假定是文件路径或 URL
                 if (inputFile.startsWith('file://') || window.path.isAbsolute(inputFile)) {
                    const filePath = inputFile.startsWith('file://') ? decodeURIComponent(new URL(inputFile).pathname) : inputFile;
                    const fileContent = await fsUtil.readFile(filePath);
                    dataToProcess = typeof fileContent === 'string'
                        ? new Uint8Array(Buffer.from(fileContent))
                        : new Uint8Array(fileContent);
                 } else { // 认为是远程 URL
                    dataToProcess = await fetchFile(inputFile) as Uint8Array;
                 }
            } else if (inputFile instanceof File || inputFile instanceof Blob) {
                dataToProcess = new Uint8Array(await inputFile.arrayBuffer());
            } else {
                throw new Error('Unsupported input type for FFmpeg');
            }

            await this.ffmpeg.writeFile(inputFileName, dataToProcess);
            // -y: 覆盖输出文件 -hide_banner: 隐藏版本信息 -loglevel error: 只输出错误信息
            await this.ffmpeg.exec(['-y', '-hide_banner', '-loglevel', 'error', '-i', inputFileName, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', outputFileName]);
            const data = await this.ffmpeg.readFile(outputFileName);
            
            // 清理文件系统中的文件
            await this.ffmpeg.deleteFile(inputFileName);
            await this.ffmpeg.deleteFile(outputFileName);
            logger.logInfo(`[FFmpeg] Transcoding successful: ${inputFileName}`);
            return new Blob([data], { type: 'audio/wav' });
        } catch (error) {
            logger.logError(`[FFmpeg] Transcoding error for ${inputFileName}:`, error as Error);
            try {
                await this.ffmpeg.deleteFile(inputFileName).catch(() => {});
                await this.ffmpeg.deleteFile(outputFileName).catch(() => {});
            } catch {}
            return null;
        }
    }
}
export default new FFmpegService();