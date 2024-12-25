import {ChildProcess, fork} from "child_process";
import {ipcMain} from "electron";
import {IWindowManager} from "@/types/main/window-manager";
import {ServiceName} from "@shared/service-manager/common";
import getResourcePath from "@/common/main/get-resource-path";


class ServiceInstance {
    private serviceProcess: ChildProcess = null;
    private retryTimeOut = 6000;
    private started = false;
    private subprocessName: string;

    private hostChangeCallback: (host: string | null) => void;

    public serviceName: string;

    constructor(serviceName: string, subprocessPath: string) {
        this.serviceName = serviceName;
        this.subprocessName = subprocessPath;
    }


    onHostChange(callback: (host: string | null) => void) {
        this.hostChangeCallback = callback;
    }


    start() {
        if (this.started) {
            return;
        }
        this.started = true;
        const servicePath = getResourcePath(".service/" + this.subprocessName + ".js");
        this.serviceProcess = fork(servicePath);

        interface IMessage {
            type: "port",
            port: number
        }

        this.serviceProcess.on("message", (msg: IMessage) => {
            const host = "http://127.0.0.1:" + msg.port;
            this.hostChangeCallback(host);
        })

        this.serviceProcess.on("error", () => {
            if (this.started) {
                setTimeout(() => {
                    this.start(); // 自动重启子进程
                }, this.retryTimeOut);

                this.retryTimeOut = this.retryTimeOut > 300000 ? 300000 : this.retryTimeOut * 2;
            }
        })

        this.serviceProcess.on("exit", (code) => {
            if (this.started) {
                console.error(`Service exited with code ${code}. Restarting...`);
                setTimeout(() => {
                    this.start(); // 自动重启子进程
                }, this.retryTimeOut);

                this.retryTimeOut = this.retryTimeOut > 300000 ? 300000 : this.retryTimeOut * 2;
            }
        });
    }

    stop() {
        this.started = false;
        this.serviceProcess.removeAllListeners();
        this.serviceProcess.kill();
        this.serviceProcess = null;
        this.retryTimeOut = 6000;
        this.hostChangeCallback(null);
    }
}

interface IServiceData {
    instance: ServiceInstance;
    host: string | null;
}

class ServiceManager {
    private windowManager: IWindowManager;
    private serviceMap = new Map<ServiceName, IServiceData>();


    private addService(serviceName: ServiceName) {
        const instance = new ServiceInstance(serviceName, serviceName);
        this.serviceMap.set(serviceName, {instance, host: null});
        instance.onHostChange((host) => {
            const mainWindow = this.windowManager?.mainWindow;
            if (mainWindow) {
                mainWindow.webContents.send("@shared/service-manager/host-changed", serviceName, host);
            }
            this.serviceMap.get(serviceName).host = host;
        });

        return instance;
    }

    startService(serviceName: ServiceName) {
        this.serviceMap.get(serviceName)?.instance?.start?.();
    }

    stopService(serviceName: ServiceName) {
        this.serviceMap.get(serviceName)?.instance?.stop?.();
    }

    setup(windowManager: IWindowManager) {
        this.windowManager = windowManager;
        // put services here
        this.addService(ServiceName.RequestForwarder).start();


        ipcMain.handle("@shared/service-manager/get-service-hosts", () => {
            const serviceHosts: Record<string, string> = {};
            this.serviceMap.forEach((val, key) => {
                if (val.host) {
                    serviceHosts[key] = val.host;
                }
            })
            return serviceHosts;
        });


    }
}


export default new ServiceManager();
