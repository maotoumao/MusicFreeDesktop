import { contextBridge, ipcRenderer } from "electron";
import { IContext } from "../type";

let extPort: MessagePort = null;

type IHandler = (data: any, context: IContext) => void;
const handlers: IHandler[] = [];

function on(_type: "data", handler: IHandler) {
  handlers.push(handler);
}

function off(_type: "data", handler: IHandler) {
  const idx = handlers.indexOf(handler);
  if (idx !== -1) {
    handlers.splice(idx, 1);
  }
}

ipcRenderer.on("port", (e) => {
  extPort = e.ports[0];
  extPort.onmessage = (evt) => {
    const data = evt.data;

    const context = {
      ...(data.context || {}),
      recvTime: Date.now(),
    };
    handlers.forEach((cb) => {
      cb(data.data, context);
    });
  };
});

function sendToCenter(data: any) {
  if (extPort) {
    extPort.postMessage({
      context: {
        sendTime: Date.now(),
      },
      data,
    });
  }
}

function broadcast(data: any) {
  if (extPort) {
    extPort.postMessage({
      context: {
        sendTime: Date.now(),
        broadcast: true,
      },
      data,
    });
  }
}

const mod = {
  on,
  off,
  broadcast,
  sendToCenter,
};

contextBridge.exposeInMainWorld("@shared/message-hub", mod);
