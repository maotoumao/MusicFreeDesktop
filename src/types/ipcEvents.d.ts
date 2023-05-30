declare namespace IpcEvents {
    // 由 Renderer 发出的ipc通信
    interface Renderer {
        /** 最小化窗口 */
        'min-window': {
            skipTaskBar?: boolean; // 是否隐藏任务栏
        }

        /** 关闭窗口 */
        'close-window': undefined
    }

    // 由 Main 发出的ipc通信
    interface Main {}
}



declare namespace IpcInvoke {
    interface Renderer {
        'min-window': () => number;
    }

    interface Main {}
}