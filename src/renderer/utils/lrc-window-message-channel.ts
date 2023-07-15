let mainMessagePort: MessagePort;


export function setMainWindowMessagePort(port: MessagePort) {
    mainMessagePort = port;
}

export function sendMessageToLyricWindow(message: string) {
    mainMessagePort?.postMessage(message);
}

