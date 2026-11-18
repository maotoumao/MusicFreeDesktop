export const endTag2 = 'LYRICS200';
export async function getLyricsHeaderLength(reader) {
    if (reader.fileSize >= 143) {
        const buf = Buffer.alloc(15);
        await reader.randomRead(buf, 0, buf.length, reader.fileSize - 143);
        const txt = buf.toString('binary');
        const tag = txt.substr(6);
        if (tag === endTag2) {
            return parseInt(txt.substr(0, 6), 10) + 15;
        }
    }
    return 0;
}
