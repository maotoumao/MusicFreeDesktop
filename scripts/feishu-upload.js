const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { Client } = require('@larksuiteoapi/node-sdk');

/**
 * 飞书云空间文件上传工具
 * 支持小文件直接上传和大文件分片上传
 * 包含重试机制和错误处理
 */
class FeishuFileUploader {
    constructor(appId, appSecret, tenantAccessToken = null) {
        this.client = new Client({
            appId: appId,
            appSecret: appSecret,
            disableTokenCache: true
        });
        this.appId = appId;
        this.appSecret = appSecret;
        this.tenantAccessToken = tenantAccessToken;
        this.tokenExpireTime = null;
        this.maxRetries = 5; // 最大重试次数
        this.retryDelay = 1000; // 重试延迟（毫秒）
        this.maxFileSize = 20 * 1024 * 1024; // 20MB - 小文件直接上传的阈值
        this.chunkSize = 4 * 1024 * 1024; // 4MB - 分片大小
    }

    /**
     * 获取tenant_access_token
     */
    async getTenantAccessToken() {
        // 如果token存在且未过期（剩余时间超过5分钟），直接返回
        if (this.tenantAccessToken && this.tokenExpireTime) {
            const now = Date.now();
            const remainingTime = this.tokenExpireTime - now;
            if (remainingTime > 5 * 60 * 1000) { // 5分钟
                return this.tenantAccessToken;
            }
        }

        console.log('正在获取 tenant_access_token...');

        try {
            const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify({
                    app_id: this.appId,
                    app_secret: this.appSecret
                })
            });

            const data = await response.json();

            if (data.code !== 0) {
                throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
            }

            this.tenantAccessToken = data.tenant_access_token;
            this.tokenExpireTime = Date.now() + (data.expire * 1000);

            console.log('tenant_access_token 获取成功');
            return this.tenantAccessToken;

        } catch (error) {
            console.error('获取 tenant_access_token 失败:', error.message);
            throw error;
        }
    }    /**
     * 计算Adler-32校验和
     */
    calculateAdler32(buffer) {
        const MOD = 65521;
        let s1 = 1;  // 初始低位累加和
        let s2 = 0;  // 初始高位累加和

        // 遍历缓冲区中的每个字节
        for (let i = 0; i < buffer.length; i++) {
            // 获取无符号字节值 (0-255)
            const byte = buffer[i];

            // 更新累加值，使用模数防止溢出
            s1 = (s1 + byte) % MOD;
            s2 = (s2 + s1) % MOD;
        }

        // 组合结果: (s2 << 16) | s1
        const combinedValue = (s2 << 16) | s1;

        // 确保结果是32位无符号整数
        // 注意：JavaScript 的位操作符返回的是32位有符号整数，所以需要转换
        const result = combinedValue >>> 0;

        // 返回十进制格式的字符串
        return result.toString(10);
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 重试包装器
     */
    async withRetry(operation, operationName) {
        let lastError;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                // 检查是否是可重试的错误
                const isRetryableError = this.isRetryableError(error);

                if (!isRetryableError || attempt === this.maxRetries) {
                    console.error(`${operationName} 失败 (尝试 ${attempt}/${this.maxRetries}):`, error.message);
                    throw error;
                }

                const delayTime = this.retryDelay * Math.pow(2, attempt - 1); // 指数退避
                console.log(`${operationName} 失败 (尝试 ${attempt}/${this.maxRetries}), ${delayTime}ms 后重试...`);
                await this.delay(delayTime);
            }
        }

        throw lastError;
    }

    /**
     * 判断是否为可重试的错误
     */
    isRetryableError(error) {
        if (error.response && error.response.data) {
            const code = error.response.data.code;
            // 1061045: 频率限制错误，可重试
            // 1061001: 内部错误，可重试
            // 1064230: 数据迁移中，可重试
            return [1061045, 1061001, 1064230].includes(code);
        }

        // 网络错误等也可以重试
        return error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND';
    }    /**
     * 直接上传小文件
     */
    async uploadSmallFile(filePath, fileName, parentNode) {
        const fileBuffer = fs.readFileSync(filePath);
        const token = await this.getTenantAccessToken();

        return await this.withRetry(async () => {
            const response = await this.client.drive.v1.file.upload({
                data: {
                    file_name: fileName,
                    parent_type: 'explorer',
                    parent_node: parentNode,
                    size: fileBuffer.length,
                    file: fileBuffer
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            return response.data;
        }, '小文件上传');
    }    /**
     * 分片上传预处理
     */
    async uploadPrepare(fileName, parentNode, fileSize) {
        const token = await this.getTenantAccessToken();

        return await this.withRetry(async () => {
            const response = await this.client.drive.v1.file.uploadPrepare({
                data: {
                    file_name: fileName,
                    parent_type: 'explorer',
                    parent_node: parentNode,
                    size: fileSize
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            return response.data;
        }, '预上传');
    }/**
     * 上传单个分片
     */
    async uploadPart(uploadId, seq, chunkBuffer) {
        const checksum = this.calculateAdler32(chunkBuffer);
        const token = await this.getTenantAccessToken();

        // 创建一个真正的可读流
        const chunkStream = new Readable({
            read() { }
        });
        chunkStream.push(chunkBuffer);
        chunkStream.push(null); // 标记流结束        
        return await this.withRetry(async () => {
            const response = await this.client.drive.v1.file.uploadPart({
                data: {
                    upload_id: uploadId,
                    seq: seq,
                    size: chunkBuffer.length,
                    checksum: checksum,
                    file: chunkStream
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            return response?.data;
        }, `分片上传 (${seq})`);
    }

    /**
     * 完成分片上传
     */
    async uploadFinish(uploadId, blockNum) {
        const token = await this.getTenantAccessToken();

        return await this.withRetry(async () => {
            const response = await this.client.drive.v1.file.uploadFinish({
                data: {
                    upload_id: uploadId,
                    block_num: blockNum
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            return response.data;
        }, '完成上传');
    }

    /**
     * 分片上传大文件
     */
    async uploadLargeFile(filePath, fileName, parentNode) {
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;

        console.log(`开始分片上传文件: ${fileName} (${fileSize} bytes)`);

        // 1. 预上传
        const prepareResult = await this.uploadPrepare(fileName, parentNode, fileSize);
        const { upload_id, block_size, block_num } = prepareResult;

        console.log(`预上传成功, upload_id: ${upload_id}, 分片数量: ${block_num}`);

        // 2. 分片上传
        const fileHandle = fs.openSync(filePath, 'r');
        try {
            for (let i = 0; i < block_num; i++) {
                const start = i * block_size;
                const end = Math.min(start + block_size, fileSize);
                const chunkSize = end - start;

                const chunkBuffer = Buffer.alloc(chunkSize);
                fs.readSync(fileHandle, chunkBuffer, 0, chunkSize, start);

                console.log(`上传分片 ${i + 1}/${block_num} (${chunkSize} bytes)`);
                await this.uploadPart(upload_id, i, chunkBuffer);

                // 避免频率限制，分片之间稍微延迟
                if (i < block_num - 1) {
                    await this.delay(200);
                }
            }
        } finally {
            fs.closeSync(fileHandle);
        }

        // 3. 完成上传
        console.log('完成分片上传...');
        const finishResult = await this.uploadFinish(upload_id, block_num);

        return finishResult;
    }

    /**
     * 主上传函数 - 自动选择上传方式
     */
    async uploadFile(filePath, fileName, parentNode) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }

        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;

        console.log(`准备上传文件: ${fileName}`);
        console.log(`文件大小: ${fileSize} bytes`);
        console.log(`目标文件夹: ${parentNode}`);

        try {
            let result;

            if (fileSize <= this.maxFileSize) {
                console.log('使用直接上传方式');
                result = await this.uploadSmallFile(filePath, fileName, parentNode);
            } else {
                console.log('使用分片上传方式');
                result = await this.uploadLargeFile(filePath, fileName, parentNode);
            }

            console.log('文件上传成功!');
            return result;

        } catch (error) {
            console.error('文件上传失败:', error.message);
            if (error.response && error.response.data) {
                console.error('错误详情:', error.response.data);
            }
            throw error;
        }
    }
}

/**
 * 主函数 - 从环境变量和命令行参数获取配置
 */
async function main() {
    try {
        // 从环境变量获取配置
        const appId = process.env.FEISHU_APP_ID;
        const appSecret = process.env.FEISHU_APP_SECRET;
        const parentNode = process.env.FEISHU_PARENT_NODE;

        // 从命令行参数获取文件路径和文件名
        const args = process.argv.slice(2);
        if (args.length < 1) {
            console.error('用法: node feishu-upload.js <文件路径> [上传文件名]');
            console.error('');
            console.error('环境变量:');
            console.error('  FEISHU_APP_ID         - 飞书应用ID');
            console.error('  FEISHU_APP_SECRET     - 飞书应用密钥');
            console.error('  FEISHU_PARENT_NODE    - 云空间文件夹token');
            process.exit(1);
        }

        const filePath = path.resolve(args[0]);
        const fileName = args[1] || path.basename(filePath);

        // 验证环境变量
        if (!appId || !appSecret || !parentNode) {
            console.error('错误: 缺少必要的环境变量');
            console.error('请设置: FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_PARENT_NODE');
            process.exit(1);
        }

        // 创建上传器实例
        const uploader = new FeishuFileUploader(appId, appSecret);

        // 执行上传
        const result = await uploader.uploadFile(filePath, fileName, parentNode);

        console.log('上传结果:', result);

        if (result.file_token) {
            console.log(`文件上传成功! file_token: ${result.file_token}`);
        }

    } catch (error) {
        console.error('上传失败:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本，则执行主函数
if (require.main === module) {
    main();
}

// 导出类以供其他模块使用
module.exports = { FeishuFileUploader };
