/**
 * requestForwarder — Worker
 *
 * 运行在 Electron UtilityProcess 中的 HTTP 代理服务器。
 * 接收带有 url/headers/method 查询参数的 GET 请求，
 * 转发到目标服务器并将响应 pipe 回客户端。
 */

import http from 'http';
import https from 'https';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { IWorkerMessage, IMainMessage } from '@appTypes/infra/requestForwarder';
import { safeParse } from '@common/safeSerialize';

const DEFAULT_PORT = 52735;
const MAX_PORT_RETRIES = 20;

let retryCount = 0;
let server: http.Server | null = null;

/** 代理 Agent（由主进程通过 IPC 动态更新） */
let httpAgent: HttpProxyAgent<string> | undefined;
let httpsAgent: HttpsProxyAgent<string> | undefined;

/** 将请求转发到目标服务器 */
function forwardRequest(
    clientRes: http.ServerResponse,
    url: string,
    method: string,
    headers: Record<string, string>,
): void {
    // 修正 host header
    let host = headers?.host;

    if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
        try {
            host = new URL(url).host;
        } catch {
            clientRes.writeHead(400, { 'Content-Type': 'text/plain' });
            clientRes.end('Bad Request: Invalid URL');
            return;
        }
    }

    const isHttps = url.startsWith('https');

    const options: http.RequestOptions = {
        method,
        headers: {
            ...(headers || {}),
            host,
        },
    };

    const protocol = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;
    if (agent) {
        options.agent = agent as unknown as http.Agent;
    }

    const req = protocol.request(url, options, (targetRes) => {
        clientRes.writeHead(targetRes.statusCode ?? 502, targetRes.headers);
        targetRes.pipe(clientRes, { end: true });
    });

    req.on('error', (error) => {
        console.error('[RequestForwarder Worker] Forward error:', error.message);
        if (!clientRes.headersSent) {
            clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
        }
        clientRes.end('Bad Gateway');
    });

    req.end();
}

/** 发送消息到主进程 */
function postMessage(message: IWorkerMessage): void {
    process.parentPort?.postMessage(message);
}

/** 启动代理服务器 */
function startServer(port: number): void {
    server = http.createServer((req, res) => {
        // 仅允许 GET 请求
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            return res.end('Only GET requests are allowed');
        }

        // 健康检查端点
        if (req.url === '/heartbeat') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            return res.end('OK');
        }

        // 解析查询参数
        const query = new URLSearchParams(req.url?.slice(1) ?? '');
        const url = query.get('url');
        const method = query.get('method') || 'GET';
        const headers = safeParse<Record<string, string>>(query.get('headers') ?? '', {}) ?? {};

        // CORS 头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        if (!url) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            return res.end('Bad Request: Missing URL');
        }

        forwardRequest(res, url, method, {
            ...((req.headers as Record<string, string>) || {}),
            ...(headers || {}),
        });
    });

    // 仅监听本地回环地址，防止外部访问
    server.listen(port, '127.0.0.1', () => {
        console.log(`[RequestForwarder Worker] Proxy server running on http://127.0.0.1:${port}`);
        postMessage({ type: 'ready', port });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && retryCount < MAX_PORT_RETRIES) {
            retryCount++;
            const nextPort = port + 1;
            console.log(
                `[RequestForwarder Worker] Port ${port} in use, trying ${nextPort} (attempt ${retryCount}/${MAX_PORT_RETRIES})`,
            );
            startServer(nextPort);
        } else {
            const errorMsg =
                err.code === 'EADDRINUSE'
                    ? `All ports ${DEFAULT_PORT}-${port} are in use`
                    : err.message;
            console.error('[RequestForwarder Worker] Failed to start server:', errorMsg);
            postMessage({ type: 'error', error: errorMsg });
        }
    });
}

// 监听主进程消息
process.parentPort?.on('message', (e: Electron.MessageEvent) => {
    const data = e.data as IMainMessage;
    switch (data?.type) {
        case 'shutdown': {
            console.log('[RequestForwarder Worker] Received shutdown signal');
            server?.close(() => {
                process.exit(0);
            });
            setTimeout(() => process.exit(0), 3000);
            break;
        }
        case 'update-proxy': {
            if (data.proxyUrl) {
                httpAgent = new HttpProxyAgent(data.proxyUrl);
                httpsAgent = new HttpsProxyAgent(data.proxyUrl);
                console.log('[RequestForwarder Worker] Proxy updated');
            } else {
                httpAgent = undefined;
                httpsAgent = undefined;
                console.log('[RequestForwarder Worker] Proxy cleared, using direct connection');
            }
            break;
        }
    }
});

// 启动服务器
startServer(DEFAULT_PORT);
