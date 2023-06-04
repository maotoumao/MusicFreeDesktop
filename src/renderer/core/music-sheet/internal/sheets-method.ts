import { localPluginName } from "@/common/constant";
import { nanoid } from "nanoid";
import musicSheetDB from "./db";
import { musicSheetsStore } from "./store";
import { produce } from "immer";
import defaultSheet from "./default-sheet";

export async function initSheets(){
    try {
        const allSheets = await musicSheetDB.sheets.toArray();
        if(allSheets.length === 0 || allSheets.findIndex(item => item.id === defaultSheet.id) === -1) {
            await musicSheetDB.transaction('readwrite', musicSheetDB.sheets, async () => {
                musicSheetDB.sheets.put(defaultSheet);
            });
            musicSheetsStore.setValue([defaultSheet, ...allSheets]);
        } else {
            musicSheetsStore.setValue(allSheets)
        }
    } catch(e) {
        console.log(e)
    }
}

// 添加新歌单
export async function addSheet(sheetName: string){
    const id = nanoid();
    const newSheet: IMusic.IMusicSheetItem = {
        id,
        title: sheetName,
        createAt: Date.now(),
        platform: localPluginName,
        musicList: []
    };
    try {
        await musicSheetDB.transaction('readwrite', musicSheetDB.sheets, async () => {
            musicSheetDB.sheets.put(newSheet);
        });
        musicSheetsStore.setValue(prev => [...prev, newSheet]);
    } catch {
        throw new Error("新建失败")
    }
}


export async function getAllSheets() {
    try {
        const allSheets = await musicSheetDB.sheets.toArray();
        musicSheetsStore.setValue(allSheets);
    }  catch(e) {
        console.log(e)
    }
}

/** 更新 */
export async function updateSheet(sheetId: string, newData: IMusic.IMusicSheetItem) {
    try {
        if(!newData) {
            return;
        }
        await musicSheetDB.transaction('readwrite', musicSheetDB.sheets, async () => {
            musicSheetDB.sheets.update(sheetId, newData)
        })
        musicSheetsStore.setValue(produce(draft => {
            const currentIndex = musicSheetsStore.getValue().findIndex(_ => _.id === sheetId);
            if(currentIndex === -1) {
                draft.push(newData);
            } else {
                draft[currentIndex] = {
                    ...draft[currentIndex],
                    ...newData
                }
            }
        }))

    } catch (e){
        console.log(e);
    }
}

export async function removeSheet(sheetId: string) {
    try {
        if(sheetId === defaultSheet.id) {
            return;
        }
        await musicSheetDB.transaction('readwrite', musicSheetDB.sheets, async() => {
            musicSheetDB.sheets.delete(sheetId);
        })
        musicSheetsStore.setValue(prev => prev.filter(item => item.id !== sheetId));

    } catch (e){
        console.log(e);
    }
}