export function secondsToDuration(seconds: number | string) {
  if (typeof seconds === "string") {
    return seconds;
  } else {
    const sec = seconds % 60;
    seconds = Math.floor(seconds / 60);
    const min = seconds % 60;
    const hour = Math.floor(seconds / 60);
    const ms = `${min}`.padStart(2, "0") + ":" + `${sec}`.padStart(2, "0");
    if (hour === 0) {
      return ms;
    } else {
      return `${hour}:${ms}`;
    }
  }
}

export function delay(millsecond: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, millsecond);
  });
}
