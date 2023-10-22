export default function (cmd: IpcEvents.IPlayerCmd, payload?: any) {
  window.extPort.sendToMain({
    type: "cmd",
    data: {
      cmd,
      payload,
    },
    timestamp: Date.now(),
  });
}
