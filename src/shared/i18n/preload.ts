import { contextBridge, ipcRenderer } from "electron";
import type { IChangeLangData, ISetupData } from "./type";

async function setupLang() {
    const data: ISetupData = await ipcRenderer.invoke("shared/i18n/setup");
    console.log(data);
    return data;
}

async function changeLang(lang: string) {
    const data: IChangeLangData = await ipcRenderer.invoke("shared/i18n/changeLang", lang);
    console.log(data);
    return data;
}

const mod = {
    setupLang,
    changeLang
}

contextBridge.exposeInMainWorld("@shared/i18n", mod);

