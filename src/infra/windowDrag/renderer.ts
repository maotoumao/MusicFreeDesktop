/**
 * windowDrag — 渲染进程层
 *
 * 职责:
 *  - Win32: 无需任何操作（main 层通过 hookWindowMessage 全权处理）
 *  - macOS/Linux: 注入 mousedown/mousemove/mouseup 事件监听，
 *    检测拖拽意图后通过 preload 桥接通知主进程轮询光标位置
 *
 * 使用方式:
 *   import windowDrag from '@infra/windowDrag/renderer';
 *   windowDrag.injectHandler();
 */
import type { IPoint } from '@appTypes/infra/windowDrag';
import { DRAG_THRESHOLD, CONTEXT_BRIDGE_KEY } from './common/constant';

// ─── Preload Bridge ───

interface IMod {
    startDrag(offset: IPoint): void;
    stopDrag(): void;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

// ─── 模块实现 ───

class WindowDragRenderer {
    private injected = false;

    /**
     * 注入全窗口拖拽事件监听。
     *
     * 仅在非 Win32 平台生效（Win32 由 main 层 hookWindowMessage 处理）。
     * 拖拽阈值内的移动视为点击，不干扰正常事件处理（如按钮点击）。
     *
     * 应在辅助窗口（歌词 / 迷你模式）的 renderer 初始化时调用一次。
     */
    public injectHandler(): void {
        if (this.injected) {
            return;
        }
        this.injected = true;

        // Win32 完全由 main 层处理，无需注入 DOM 事件
        if (window.globalContext.platform === 'win32') {
            return;
        }

        let startClientPos: IPoint | null = null;
        let isMoving = false;
        let isDragging = false;

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return; // 仅左键触发
            startClientPos = { x: e.clientX, y: e.clientY };
            isMoving = true;
            isDragging = false;
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!startClientPos || !isMoving) return;

            if (!isDragging) {
                const dx = Math.abs(e.clientX - startClientPos.x);
                const dy = Math.abs(e.clientY - startClientPos.y);
                if (dx + dy < DRAG_THRESHOLD) return;

                isDragging = true;
                // 超过阈值：通知主进程开始拖拽，传入初始偏移量
                // 之后由主进程轮询光标位置，无需再发 IPC
                mod.startDrag(startClientPos);
            }
        };

        const onMouseUp = () => {
            if (isDragging) {
                mod.stopDrag();
            }
            isMoving = false;
            isDragging = false;
            startClientPos = null;
        };

        // 使用 setTimeout 确保 DOM 完全就绪
        const inject = () => {
            window.addEventListener('mousedown', onMouseDown);
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        if (document.readyState === 'complete') {
            setTimeout(inject);
        } else {
            window.addEventListener('load', () => setTimeout(inject));
        }
    }
}

const windowDrag = new WindowDragRenderer();
export default windowDrag;
