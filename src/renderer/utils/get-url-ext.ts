export default function getUrlExt(url?: string) {
    if (!url) {
        return;
    }
    const urlObj = new URL(url);
    const ext = window.path.extname(urlObj.pathname);
    return ext;
}
