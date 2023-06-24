declare namespace IpcEvents {
    // 由 Main 发出的ipc通信
    type Plugin = import("@main/core/plugin-manager/plugin").Plugin;
    type AppConfig = import("@/common/app-config/type").IAppConfig;
    interface Main {
        /** 插件 */
        "plugin-loaded": IPlugin.IPluginDelegate[],
        "sync-app-config": AppConfig,
    }
}