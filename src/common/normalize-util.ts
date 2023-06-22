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
