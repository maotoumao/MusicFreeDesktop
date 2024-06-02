import { contextBridge, ipcRenderer } from "electron";
import EventEmitter from "eventemitter3";
import type { IContext, IHandlerType } from "../type";

const extPorts = new Map<number, MessagePort>();

const evtHub = new EventEmitter();

function on<K extends keyof IHandlerType>(type: K, handler: IHandlerType[K]) {
  evtHub.on(type, handler);
}

function off<K extends keyof IHandlerType>(type: K, handler: IHandlerType[K]) {
  evtHub.off(type, handler);
}

//@ts-ignore
window.__extPorts = extPorts;

// 主窗口的端口信息
ipcRenderer.on("port", (e, message) => {
  // 接收到端口，使其全局可用
  if (message.type === "mount") {
    const expPort = e.ports[0];
    extPorts.set(message.id, expPort);
    expPort.onmessage = (evt) => {
      // 监听事件
      const data = evt.data;
      const context: IContext = {
        recvTime: Date.now(),
        from: message.id,
        ...(data?.context || {}),
      };
      if (data?.data?.type === "ready") {
        evtHub.emit("ready", message.id);
      } else {
        evtHub.emit("data", data.data, context);
      }

      if (context.broadcast) {
        broadcast(data.data, {
          exception: [message.id],
        });
      }
    };
    evtHub.emit("mount", message.id);
  } else if (message.type === "unmount") {
    const expPort = extPorts.get(message.id);
    if (expPort) {
      evtHub.emit("unmount", message.id);
      expPort.close();
      extPorts.delete(message.id);
    }
  } else if (message.type === "broadcast") {
    broadcast(message.data);
  } else if (message.type === "data") {
    evtHub.emit("data", message.data, {
      fromMainProcess: true,
      recvTime: Date.now(),
    });
  }
});

function broadcast(
  data?: any,
  options?: {
    exception?: number[];
    includeMainProcess?: boolean;
  }
) {
  const { exception, includeMainProcess } = options || {};
  extPorts.forEach((port, extId) => {
    if (exception?.includes(extId)) {
      return;
    }
    port.postMessage({
      context: {
        sendTime: Date.now(),
        broadcast: true,
      },
      data,
    });
  });
  if (includeMainProcess) {
    sendToMainProcess(data);
  }
}

function sendToExtension(extId: number, data?: any) {
  const port = extPorts.get(extId);
  if (port) {
    port.postMessage({
      context: {
        sendTime: Date.now(),
      },
      data,
    });
  }
}

function sendToMainProcess(data: any) {
  ipcRenderer.send("@shared/message-hub/message", data);
}

const mod = {
  on,
  off,
  broadcast,
  sendToExtension,
};

contextBridge.exposeInMainWorld("@shared/message-hub", mod);
