import { useEffect } from 'react';
import fsUtil from '@infra/fsUtil/renderer';
import { playLocalFiles } from '../core/playLocalFiles';

/**
 * 把文件 / 文件夹拖进主窗口即可播放。
 * 同时阻止浏览器默认行为（把整个窗口导航到被拖入的文件）。
 * 组件自行处理了拖放的区域（如插件安装弹窗）会阻止冒泡，不会进入这里。
 */
export function useFileDrop(): void {
    useEffect(() => {
        const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;

        const onDragOver = (e: DragEvent) => {
            if (!hasFiles(e) || e.defaultPrevented) return;
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
        };

        const onDrop = (e: DragEvent) => {
            if (!hasFiles(e) || e.defaultPrevented) return;
            e.preventDefault();
            const paths = Array.from(e.dataTransfer!.files)
                .map((file) => fsUtil.getPathForFile(file))
                .filter(Boolean);
            playLocalFiles(paths).catch((err) => {
                console.error('[useFileDrop] play dropped files failed:', err);
            });
        };

        window.addEventListener('dragover', onDragOver);
        window.addEventListener('drop', onDrop);
        return () => {
            window.removeEventListener('dragover', onDragOver);
            window.removeEventListener('drop', onDrop);
        };
    }, []);
}
