export default function getUrlExt(url: string) {
    const urlObj = new URL(url);
    const ext = window.path.extname(urlObj.pathname);
    return ext;
}