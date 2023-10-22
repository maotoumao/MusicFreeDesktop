import { ipcRenderer } from "electron";


const extPorts = new Map<number, MessagePort>()

type IHandler = (data: any, from: number) => void;
const handlers: IHandler[] = [];
let onMountHandler: (from: number) => void;
let onUnMountHandler: (from: number) => void;

function on(handler: IHandler) {
    handlers.push(handler);
}

function onMount(handler: (from: number) => void) {
    onMountHandler = handler;
}

function onUnMount(handler: (from: number) => void) {
    onUnMountHandler = handler;
}

//@ts-ignore
window.__extPorts = extPorts;

ipcRenderer.on("port", (e, message) => {
  // 接收到端口，使其全局可用。
  if(message.type === 'mount') {
    const mainPort = e.ports[0];
    extPorts.set(message.id, mainPort);
    mainPort.onmessage = evt => {
        // 监听事件
        handlers.forEach(cb => {
            cb(evt.data, message.id);
        })
    }
    onMountHandler?.(message.id);

  } else if(message.type === 'unmount') {
    const mainPort = extPorts.get(message.id);
    if(mainPort) {
        onUnMountHandler?.(message.id);
        mainPort.close();
        extPorts.delete(message.id);
    }
  }
});

function broadcast(data?: any){
    extPorts.forEach(port => {
        port.postMessage(data);
    })
}

function sendTo(id: number, data?: any) {
    const port = extPorts.get(id);
    if(port) {
        port.postMessage(data);
    }
}


export default {
    broadcast,
    sendTo,
    /** 主窗口收到消息 */
    on,
    onMount,
    onUnMount,
}