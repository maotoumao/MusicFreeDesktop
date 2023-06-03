import { ipcRendererOn } from "@/common/ipc-util/renderer";
import serializablePluginsStore from "./store";
import { refreshPlugins } from "./methods";

function onPluginLoaded(){
    ipcRendererOn('plugin-loaded', (plugins) => {
        serializablePluginsStore.setValue(plugins);
    })
}


export function registerPluginEvents(){
    onPluginLoaded();
    refreshPlugins();
}

