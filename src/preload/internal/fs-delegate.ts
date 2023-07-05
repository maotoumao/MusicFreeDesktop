import fs from 'fs/promises';

const originalFsWriteFile = fs.writeFile;
const originalFsReadFile = fs.readFile;

function writeFile(...args: Parameters<typeof originalFsWriteFile>): ReturnType<typeof originalFsWriteFile> {
    return originalFsWriteFile(...args);
}
function readFile(...args: Parameters<typeof originalFsReadFile>): ReturnType<typeof originalFsReadFile> {
    return originalFsReadFile(...args);
}

export default {
    writeFile,
    readFile
}