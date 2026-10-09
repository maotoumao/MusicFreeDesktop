/**
 * Request Forwarder 模块
 *
 * 在 UtilityProcess 中运行本地 HTTP 代理服务器，
 * 使 <audio> 等标签能间接发起带自定义 HTTP Header 的请求。
 */

/** 代理服务器连接信息（端口 + 访问令牌），渲染进程据此构建代理 URL */
export interface IRequestForwarderInfo {
    port: number;
    token: string;
}

/** Worker → Main 进程消息 */
export type IWorkerMessage = { type: 'ready'; port: number } | { type: 'error'; error: string };

/** Main → Worker 消息 */
export type IMainMessage =
    | { type: 'init'; token: string }
    | { type: 'shutdown' }
    | { type: 'update-proxy'; proxyUrl: string | null };
