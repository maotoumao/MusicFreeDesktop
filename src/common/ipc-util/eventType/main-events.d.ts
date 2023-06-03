declare namespace IpcEvents {
    // 由 Main 发出的ipc通信
    type Plugin = import("@main/core/plugin-manager/plugin").Plugin;
    interface Main {
        /** 插件 */
        "plugin-loaded": IPlugin.IPluginSerializable[]
    }
}