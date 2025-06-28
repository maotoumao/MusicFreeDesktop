import { contextBridge, ipcRenderer } from "electron";
import { ServiceName } from "@shared/service-manager/common";

const serviceHostMap = new Map<ServiceName, string>();

ipcRenderer.on("@shared/service-manager/host-changed", (_evt, serviceName: ServiceName, host: string | null) => {
    if (host) {
        serviceHostMap.set(serviceName, host);
    } else {
        serviceHostMap.delete(serviceName);
    }
});



async function setup() {
    const hosts = (await ipcRenderer.invoke("@shared/service-manager/get-service-hosts")) || {};
    const serviceNames = Object.keys(hosts);
    for (const serviceName of serviceNames) {
        serviceHostMap.set(serviceName as any, hosts[serviceName]);
    }
}

function getServiceHost(serviceName: ServiceName) {
    return serviceHostMap.get(serviceName);
}

const mod = {
    setup,
    getServiceHost,
};

contextBridge.exposeInMainWorld("@shared/service-manager", mod);

