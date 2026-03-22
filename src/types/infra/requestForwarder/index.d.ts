/**
 * Request Forwarder 模块
 *
 * 在 UtilityProcess 中运行本地 HTTP 代理服务器，
 * 使 <audio> 等标签能间接发起带自定义 HTTP Header 的请求。
 */

/** Worker → Main 进程消息 */
export type IWorkerMessage = { type: 'ready'; port: number } | { type: 'error'; error: string };

/** Main → Worker 消息 */
export type IMainMessage = { type: 'shutdown' } | { type: 'update-proxy'; proxyUrl: string | null };
