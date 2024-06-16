import url from "url";

function addFileScheme(filePath: string) {
  return filePath.startsWith("file:")
    ? filePath
    : url.pathToFileURL(filePath).toString();
}



export default {
  addFileScheme
}