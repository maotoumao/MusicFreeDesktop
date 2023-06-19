import { app } from 'electron';
import fs from 'fs/promises'
import path from 'path';
import { Plugin } from './plugin';
import { ipcMainHandle, ipcMainOn, ipcMainSend } from '@/common/ipc-util/main';
import { getMainWindow } from '@/main/window';

const pluginBasePath = path.resolve(app.getAppPath(), './plugins');

let plugins: Plugin[] = [];
let clonedPlugins: IPlugin.IPluginDelegate[] = [];

function setPlugins(newPlugins: Plugin[]) {
    plugins = newPlugins;
    clonedPlugins = plugins.map(p => {
        const sPlugin: IPlugin.IPluginDelegate = {} as any;
        sPlugin.supportedMethod = [];
        for(const k in p.instance) {
            // @ts-ignore
            if(typeof p.instance[k] === 'function') {
                sPlugin.supportedMethod.push(k);
            } else {
                // @ts-ignore
                sPlugin[k] = p.instance[k];
            }
        }
        sPlugin.hash = p.hash;
        sPlugin.path = p.path;
        return JSON.parse(JSON.stringify(sPlugin));
    })
}

export async function initPluginManager(){
    registerEvents();
    try {
        await fs.stat(pluginBasePath);
        await loadAllPlugins();
    } catch {
        await fs.mkdir(pluginBasePath);
    }
}

/** 注册事件 */
function registerEvents(){
    /** 调用插件方法 */
    ipcMainHandle('call-plugin-method', callPluginMethod);

    /** 获取插件 */
    ipcMainHandle('get-all-plugins', () => clonedPlugins);

    /** 刷新插件 */
    ipcMainOn('refresh-plugins', loadAllPlugins);
}


interface ICallPluginMethodParams<T extends keyof IPlugin.IPluginInstanceMethods> {
    hash: string;
    platform: string;
    method: T,
    args: Parameters<IPlugin.IPluginInstanceMethods[T]>
}

/** 调用插件方法 */
function callPluginMethod({
    hash,
    platform,
    method,
    args
}: ICallPluginMethodParams<keyof IPlugin.IPluginInstanceMethods>) {
    let plugin: Plugin;
        if(hash){
            plugin = plugins.find(item => item.hash === hash);
        } else if(platform) {
            plugin = plugins.find(item => item.name === platform);
        }
        if(!plugin) {
            return null;
        }
        return plugin.methods[method]?.apply?.({plugin}, args);
}

/** 加载所有插件 */
export async function loadAllPlugins(){
    const rawPluginNames = await fs.readdir(pluginBasePath);
    const pluginHashSet = new Set<string>();
    const _plugins: Plugin[] = [];
    for(let i = 0; i < rawPluginNames.length; ++i) {
        try {
            const pluginPath = path.resolve(pluginBasePath, rawPluginNames[i]);
            const filestat = await fs.stat(pluginPath);
            if(filestat.isFile() && path.extname(pluginPath) === '.js') {
                const funcCode = await fs.readFile(pluginPath, 'utf-8');
                const plugin = new Plugin(funcCode, pluginPath);
                if(pluginHashSet.has(plugin.hash)) {
                    continue;
                }
                if(plugin.hash !== '') {
                    pluginHashSet.add(plugin.hash);
                    _plugins.push(plugin);
                }
            }
        } catch(e){
            console.log(e);
        }
    }
    setPlugins(_plugins);

    const mainWindow = getMainWindow();
    ipcMainSend(mainWindow, 'plugin-loaded', clonedPlugins);
}