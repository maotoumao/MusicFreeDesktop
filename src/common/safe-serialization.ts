export function safeStringify(object: object) {
  try {
    return JSON.stringify(object);
  } catch {
    return "";
  }
}

export function safeParse(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
