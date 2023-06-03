import Store from "@/common/store";

const serializablePluginsStore = new Store<IPlugin.IPluginSerializable[]>([])

export default serializablePluginsStore;

console.log(serializablePluginsStore)