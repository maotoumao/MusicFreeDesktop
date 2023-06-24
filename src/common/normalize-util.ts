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
  if (url.indexOf('#') === -1) {
      return `${url}#${Date.now()}`;
  }
  return url;
}
