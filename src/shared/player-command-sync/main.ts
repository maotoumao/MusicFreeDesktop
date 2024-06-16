import { sendToMainWindow } from "../message-hub/main";

export function sendCommand<T extends keyof ICommon.ICommand>(
  type: T,
  data?: ICommon.ICommand[T]
) {
  sendToMainWindow({
    cmd: type,
    data,
  });
}
