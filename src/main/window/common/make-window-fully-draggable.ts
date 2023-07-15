/**
 * https://github.com/electron/electron/issues/1354#issuecomment-1356330873
 */

import {BrowserWindow} from 'electron';

const WM_MOUSEMOVE = 0x0200;  // https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousemove
const WM_LBUTTONUP = 0x0202;  // https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-lbuttonup

const MK_LBUTTON = 0x0001;

const makeWindowFullyDraggable = (browserWindow: BrowserWindow, width: number, height: number): void => {
    const initialPos = {
        x: 0,
        y: 0,
        height,
        width,
    };

    let dragging = false;

    browserWindow.hookWindowMessage(WM_LBUTTONUP, () => {
        dragging = false;
    });
    browserWindow.hookWindowMessage(
        WM_MOUSEMOVE,
        (wParam: Buffer, lParam: Buffer) => {
            if (!browserWindow) {
                return;
            }

            const wParamNumber: number = wParam.readInt16LE(0);

            if (!(wParamNumber & MK_LBUTTON)) { // <-- checking if left mouse button is pressed
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
            browserWindow.setBounds({
                x: x + browserWindow.getPosition()[0] - initialPos.x,
                y: y + browserWindow.getPosition()[1] - initialPos.y,
                height: initialPos.height,
                width: initialPos.width,
            });
        }
    );
};

export default makeWindowFullyDraggable;