/**
 * requestForwarder — Worker
 *
 * 运行在 Electron UtilityProcess 中的 HTTP 代理服务器。
 * 接收带有 token/url/headers 查询参数的 GET 请求，
 * 以 GET 方式转发到目标服务器并将响应流式回传客户端。
 *
 * 安全约束：
 * - 仅监听 127.0.0.1，局域网不可达
 * - 每个请求必须携带主进程下发的随机 token，否则 403。
 *   本机任意网页都能向 127.0.0.1 发请求，没有 token 即成为任意网页可用的 SSRF 跳板
 * - 不返回 CORS 头：唯一调用方是 <audio src>（no-cors 加载），不需要跨源读取
 * - 仅转发 http/https，且方法固定为 GET
 */

import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { pipeline } from 'stream';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { IWorkerMessage, IMainMessage } from '@appTypes/infra/requestForwarder';
import { safeParse } from '@common/safeSerialize';
import { TOKEN_PARAM } from './common/constant';

const DEFAULT_PORT = 52735;
const MAX_PORT_RETRIES = 20;

/**
 * 逐跳（hop-by-hop）头：仅描述「单段连接」，由代理这一跳消费，
 * 不能原样转发到另一段连接（RFC 7230 §6.1）。转发前必须剔除，
 * 让下游连接自行决定其传输编码与连接管理，避免 chunked/Content-Length 冲突。
 */
const HOP_BY_HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);

/** 上游空闲超时：源站接受连接后若该时长内无数据收发则回收（活跃流式会自动重置计时） */
const UPSTREAM_IDLE_TIMEOUT_MS = 30_000;

let retryCount = 0;
let server: http.Server | null = null;

/** 访问令牌（由主进程通过 init 消息下发，收到后才启动服务器） */
let tokenBuffer: Buffer | null = null;

/** 代理 Agent（由主进程通过 IPC 动态更新） */
let httpAgent: HttpProxyAgent<string> | undefined;
let httpsAgent: HttpsProxyAgent<string> | undefined;

/** 剔除逐跳头，返回仅含端到端头的新对象（如 range/accept-encoding/content-* 均保留） */
function stripHopByHopHeaders<T extends http.IncomingHttpHeaders | http.OutgoingHttpHeaders>(
    headers: T,
): T {
    const result = {} as T;
    for (const key of Object.keys(headers)) {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
            (result as Record<string, unknown>)[key] = (headers as Record<string, unknown>)[key];
        }
    }
    return result;
}

/** 常量时间校验 token，防止计时侧信道 */
function isAuthorized(token: string | null): boolean {
    if (!tokenBuffer || !token) return false;
    const candidate = Buffer.from(token);
    return (
        candidate.length === tokenBuffer.length && crypto.timingSafeEqual(candidate, tokenBuffer)
    );
}

/**
 * 规范化调用方传入的 headers：JSON 可能是任意形状（数组、嵌套对象、数字等），
 * 仅保留字符串值，数字/布尔转为字符串，其余丢弃，避免后续处理因类型不符抛错。
 */
function sanitizeHeaders(raw: unknown): Record<string, string> {
    const result: Record<string, string> = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'string') {
            result[key] = value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            result[key] = String(value);
        }
    }
    return result;
}

/** 上游响应头：剔除逐跳头与 CORS 头（CORS 策略由本服务决定，不能被上游放开） */
function filterResponseHeaders(headers: http.IncomingHttpHeaders): http.IncomingHttpHeaders {
    const result = stripHopByHopHeaders(headers);
    for (const key of Object.keys(result)) {
        if (key.toLowerCase().startsWith('access-control-')) {
            delete result[key];
        }
    }
    return result;
}

function respondText(res: http.ServerResponse, statusCode: number, text: string): void {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end(text);
}

/** 将请求以 GET 方式转发到目标服务器 */
function forwardRequest(
    clientRes: http.ServerResponse,
    targetUrl: URL,
    headers: Record<string, string>,
): void {
    // 修正 host header
    let host = headers?.host;

    if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
        host = targetUrl.host;
    }

    const isHttps = targetUrl.protocol === 'https:';

    const requestHeaders: http.OutgoingHttpHeaders = stripHopByHopHeaders(headers || {});
    // 转发的 GET 不带请求体，调用方传入的 Content-Length 会让源站一直等待请求体
    for (const key of Object.keys(requestHeaders)) {
        if (key.toLowerCase() === 'content-length') {
            delete requestHeaders[key];
        }
    }

    const options: http.RequestOptions = {
        method: 'GET',
        headers: {
            ...requestHeaders,
            host,
        },
    };

    const agent = isHttps ? httpsAgent : httpAgent;
    if (agent) {
        options.agent = agent as unknown as http.Agent;
    }

    const onResponse = (targetRes: http.IncomingMessage) => {
        try {
            // 上游可能返回非法状态码（如 099）或非法响应头，writeHead 会同步抛错
            clientRes.writeHead(
                targetRes.statusCode ?? 502,
                filterResponseHeaders(targetRes.headers),
            );
        } catch (err) {
            console.error(
                '[RequestForwarder Worker] Invalid upstream response:',
                (err as Error).message,
            );
            targetRes.destroy();
            if (!clientRes.headersSent && clientRes.writable) {
                respondText(clientRes, 502, 'Bad Gateway');
            } else {
                clientRes.destroy();
            }
            return;
        }
        // pipeline 自动传播两端错误并销毁两端，避免未处理的 stream error 导致 worker 崩溃
        pipeline(targetRes, clientRes, (err) => {
            if (err) {
                console.error('[RequestForwarder Worker] Stream error:', err.message);
            }
        });
    };

    let req: http.ClientRequest;
    try {
        req = isHttps
            ? https.request(targetUrl, options, onResponse)
            : http.request(targetUrl, options, onResponse);
    } catch (err) {
        // 非法 header 名/值（如含换行）会让 http.request 同步抛错，不能让它打崩 worker
        console.error('[RequestForwarder Worker] Invalid request:', (err as Error).message);
        respondText(clientRes, 400, 'Bad Request: Invalid Request Options');
        return;
    }

    // 客户端断连（seek/切歌/缓冲中止）时中止上游请求，防止上游 socket 泄漏耗尽并发连接
    clientRes.on('close', () => {
        req.destroy();
    });

    // 上游空闲超时：源站接受连接却迟迟不返回数据时回收，防止挂起连接累积
    req.setTimeout(UPSTREAM_IDLE_TIMEOUT_MS, () => {
        if (!clientRes.headersSent && clientRes.writable) {
            clientRes.writeHead(504, { 'Content-Type': 'text/plain' });
            clientRes.end('Gateway Timeout');
        }
        req.destroy();
    });

    // 源站返回 101 时 Node 不会触发 response/error，需显式结束客户端响应，否则客户端一直挂起
    req.on('upgrade', (_upgradeRes, socket) => {
        socket.destroy();
        if (!clientRes.headersSent && clientRes.writable) {
            respondText(clientRes, 502, 'Bad Gateway');
        }
    });

    req.on('error', (error) => {
        console.error('[RequestForwarder Worker] Forward error:', error.message);
        if (!clientRes.headersSent && clientRes.writable) {
            clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
            clientRes.end('Bad Gateway');
        } else if (clientRes.writable) {
            clientRes.end();
        }
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
        // 解析查询参数
        const query = new URLSearchParams(req.url?.slice(1) ?? '');

        // 鉴权先于一切其他处理，未授权请求一律 403，不暴露任何行为差异
        if (!isAuthorized(query.get(TOKEN_PARAM))) {
            return respondText(res, 403, 'Forbidden');
        }

        // 仅允许 GET 请求
        if (req.method !== 'GET') {
            return respondText(res, 405, 'Only GET requests are allowed');
        }

        const url = query.get('url');
        const headers = sanitizeHeaders(safeParse<unknown>(query.get('headers') ?? '', {}));

        if (!url) {
            return respondText(res, 400, 'Bad Request: Missing URL');
        }

        let targetUrl: URL;
        try {
            targetUrl = new URL(url);
        } catch {
            return respondText(res, 400, 'Bad Request: Invalid URL');
        }
        if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
            return respondText(res, 400, 'Bad Request: Unsupported Protocol');
        }

        forwardRequest(res, targetUrl, {
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
        case 'init': {
            // token 下发后才开始监听，保证服务器从第一个请求起就处于鉴权状态
            if (!tokenBuffer && data.token) {
                tokenBuffer = Buffer.from(data.token);
                startServer(DEFAULT_PORT);
            }
            break;
        }
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
