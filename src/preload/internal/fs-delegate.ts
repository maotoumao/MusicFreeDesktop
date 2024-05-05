import fs from "fs/promises";

const originalFsWriteFile = fs.writeFile;
const originalFsReadFile = fs.readFile;

function writeFile(...args: Parameters<typeof originalFsWriteFile>): ReturnType<typeof originalFsWriteFile> {
    return originalFsWriteFile(...args);
}
function readFile(...args: Parameters<typeof originalFsReadFile>): ReturnType<typeof originalFsReadFile> {
    return originalFsReadFile(...args);
}

async function isFile(path: string) {
    try {
        const stat = await fs.stat(path);
        return stat.isFile();
    } catch {
        return false;
    }
}

async function isFolder(path: string) {
    try {
        const stat = await fs.stat(path);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

export default {
    writeFile,
    readFile,
    isFile,
    isFolder
}