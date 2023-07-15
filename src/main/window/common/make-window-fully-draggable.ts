/**
 * TODO win32api 区分平台
 * https://github.com/electron/electron/issues/1354#issuecomment-1356330873
 */

import { BrowserWindow } from "electron";

const WM_MOUSEMOVE = 0x0200; // https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousemove
const WM_LBUTTONUP = 0x0202; // https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-lbuttonup

const MK_LBUTTON = 0x0001;

const makeWindowFullyDraggable = (
  browserWindow: BrowserWindow,
  options: {
    width: number;
    height: number;
    onMouseUp: (position: ICommon.IPoint | null) => void;
  }
): void => {
  const { height, width, onMouseUp } = options;
  const initialPos = {
    x: 0,
    y: 0,
    height,
    width,
  };

  let dragging = false;
  let cachePosition: ICommon.IPoint | null = null;

  browserWindow.hookWindowMessage(WM_LBUTTONUP, () => {
    dragging = false;
    onMouseUp(cachePosition);
    cachePosition = null;
  });
  browserWindow.hookWindowMessage(
    WM_MOUSEMOVE,
    (wParam: Buffer, lParam: Buffer) => {
      if (!browserWindow) {
        return;
      }

      const wParamNumber: number = wParam.readInt16LE(0);

      if (!(wParamNumber & MK_LBUTTON)) {
        // <-- checking if left mouse button is pressed
        return;
      }

      const x = lParam.readInt16LE(0);
      const y = lParam.readInt16LE(2);
      if (!dragging) {
        dragging = true;
        initialPos.x = x;
        initialPos.y = y;
        initialPos.height = height;
        initialPos.width = width;
        return;
      }

      cachePosition = {
        x: x + browserWindow.getPosition()[0] - initialPos.x,
        y: y + browserWindow.getPosition()[1] - initialPos.y,
      };
      browserWindow.setBounds({
        x: cachePosition.x,
        y: cachePosition.y,
        height: initialPos.height,
        width: initialPos.width,
      });
    }
  );
};

export default makeWindowFullyDraggable;
