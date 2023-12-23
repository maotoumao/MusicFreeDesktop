export function normalizeNumber(number: number): string {
  if (number < 10000) {
    return `${number}`;
  }
  number = number / 10000;
  if (number < 10000) {
    return `${number.toFixed(number < 1000 ? 1 : 0)}万`;
  }
  number = number / 10000;
  return `${number.toFixed(number < 1000 ? 1 : 0)}亿`;
}

export function addRandomHash(url: string) {
  if (url.indexOf("#") === -1) {
    return `${url}#${Date.now()}`;
  }
  return url;
}

/** url hack */
export function encodeUrlHeaders(
  originalUrl: string,
  headers?: Record<string, string>
) {
  let formalizedKey: string;
  const _setHeaders: Record<string, string> = {};

  for (const key in headers) {
    formalizedKey = key.toLowerCase();
    _setHeaders[formalizedKey] = headers[key];
  }
  const encodedUrl = new URL(originalUrl);
  encodedUrl.searchParams.set(
    "_setHeaders",
    encodeURIComponent(JSON.stringify(_setHeaders))
  );
  return encodedUrl.toString();
}

export function isBetween(target: number, a: number, b: number) {
  if (a > b) {
    return a >= target && target >= b;
  }
  return b >= target && target >= a;
}

export function isBasicType(val: unknown) {
  const tp = typeof val;
  if (
    tp === "string" ||
    tp === "boolean" ||
    tp === "number" ||
    tp === "undefined" ||
    val === null
  ) {
    return true;
  }
  return false;
}

const fileSizeUnits = ["B", "KB", "MB", "GB", "TB"];
export function normalizeFileSize(bytes: number) {
  let ptr = 0;
  while (bytes >= 1024 && ptr < fileSizeUnits.length) {
    bytes = bytes / 1024;
    ++ptr;
  }
  return `${bytes.toFixed(1)}${fileSizeUnits[ptr]}`;
}
