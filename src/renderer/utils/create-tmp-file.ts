import { nanoid } from "nanoid";

export async function createTmpFile(data: string) {
  if (!window.globalData?.appPath?.temp) {
    throw new Error("TempFile Path NotFound");
  }
  const randomFileName = nanoid();
  const filePath = window.path.resolve(
    window.globalData.appPath.temp,
    randomFileName
  );
  await window.fs.writeFile(filePath, data, "utf-8");

  return {
    fileName: randomFileName,
    filePath,
    async clearTmpFile() {
      await window.rimraf(filePath);
    },
  };
}
