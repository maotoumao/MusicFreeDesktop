import { ipcRendererOn } from "@/common/ipc-util/renderer";
import delegatePluginsStore from "./store";
import { refreshPlugins } from "./methods";

function onPluginLoaded(){
    ipcRendererOn('plugin-loaded', (plugins) => {
        delegatePluginsStore.setValue(plugins);
    })
}


export function registerPluginEvents(){
    onPluginLoaded();
    refreshPlugins();
}

