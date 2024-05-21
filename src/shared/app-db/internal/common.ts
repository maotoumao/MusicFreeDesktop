/**
 * Evt send by Main process
 */
export enum IpcMainEvt {}

/**
 * Evt send by Renderer process
 */
export enum IpcRendererEvt {
  GET_DB_PATH = "shared/app-db/get-db-path",
}
