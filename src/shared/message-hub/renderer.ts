import { IHandlerType } from "./type";

const mod = window["@shared/message-hub" as any] as any;

/**
 * 监听事件
 * @param type 扩展窗口取值只有data
 * @param handler
 */
function on<K extends keyof IHandlerType>(type: K, handler: IHandlerType[K]) {
  mod.on(type, handler);
}

/**
 * 取消监听事件
 * @param type
 * @param handler
 */
function off<K extends keyof IHandlerType>(type: K, handler: IHandlerType[K]) {
  mod.off(type, handler);
}

const voidFn = () => {};

/** 广播给所有窗口 */
const broadcast: (
  data: any,
  options?: {
    includeMainProcess?: boolean;
  }
) => void = mod.broadcast;

/** 向扩展窗口发送消息 */
const sendToExtension: (extId: number, data?: any) => void =
  mod.sendToExtension || voidFn;
/** 向主窗口发送消息 */
const sendToCenter: (data: any) => void = mod.sendToCenter || voidFn;

const MessageHub = {
  on,
  off,
  broadcast,
  sendToExtension,
  sendToCenter,
};

export default MessageHub;
