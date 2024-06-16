import { getGlobalContext } from "@/shared/global-context/renderer";
import { nanoid } from "nanoid";

export async function createTmpFile(data: string) {
  const { appPath } = getGlobalContext();
  if (!appPath.temp) {
    throw new Error("TempFile Path NotFound");
  }
  const randomFileName = nanoid();
  const filePath = window.path.resolve(appPath.temp, randomFileName);
  await window.fs.writeFile(filePath, data, "utf-8");

  return {
    fileName: randomFileName,
    filePath,
    async clearTmpFile() {
      await window.rimraf(filePath);
    },
  };
}
