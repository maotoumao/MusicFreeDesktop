import path from 'path';
export default function getUrlExt(url?: string) {
  if (!url) {
    return;
  }
  const urlObj = new URL(url);
  const ext = path.extname(urlObj.pathname);
  return ext;
}
