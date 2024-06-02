export interface IContext {
  sendTime?: number;
  recvTime?: number;
  from?: number;
  fromMainProcess?: boolean;
  broadcast?: boolean;
}

export interface IHandlerType {
  /** 扩展窗口挂载 */
  mount: (extId: number) => void;
  ready: (extId: number) => void;
  /** 扩展窗口卸载 */
  unmount: (extId: number) => void;
  data: (data: any, context?: IContext) => void;
}
