import { ipcRenderer } from "electron";

let extPort: MessagePort = null;

type IHandler = (data: any) => void;
const handlers: IHandler[] = [];

function on(handler: IHandler) {
    handlers.push(handler);
}

ipcRenderer.on("port", (e) => {
  extPort = e.ports[0];
  extPort.onmessage = evt => {
    handlers.forEach(cb => {
        cb(evt.data);
    })
  }
});

function sendToMain(data: any) {
    if(extPort) {
        extPort.postMessage(data);
    }
}


export default {
  sendToMain,
  on,
};
