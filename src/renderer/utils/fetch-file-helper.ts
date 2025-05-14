const readFromBlobOrFile = (blob: Blob | File): Promise<ArrayBuffer> => (
  new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => {
      resolve(fileReader.result as ArrayBuffer);
    };
    fileReader.onerror = ({ target }) => {
      reject(Error(`File could not be read! Code=${(target?.error as any)?.code}`));
    };
    fileReader.readAsArrayBuffer(blob);
  })
);

export const fetchFile = async (data: string | File | Blob | ArrayBuffer): Promise<Uint8Array> => {
  let buffer: ArrayBuffer;
  if (typeof data === 'undefined') {
    return new Uint8Array();
  }

  if (typeof data === 'string') {
    /* From base64 format */
    if (/data:_data\/([a-zA-Z]*);base64,([^"]*)/.test(data)) {
      const byteString = atob(data.split(',')[1]);
      buffer = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(buffer);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
    /* From remote server/URL */
    } else {
      // 注意：在 Electron 渲染进程中，直接使用 import.meta.url 可能指向的是打包后的文件路径，
      // 而不是期望的 HTTP URL 上下文。对于外部 URL，应直接使用。
      // 如果 data 本身就是完整的 URL，则不需要 new URL(data, import.meta.url).href
      const res = await fetch(data);
      buffer = await res.arrayBuffer();
    }
  /* From Blob or File */
  } else if (data instanceof File || data instanceof Blob) {
    buffer = await readFromBlobOrFile(data);
  } else if (data instanceof ArrayBuffer) {
    buffer = data;
  } else {
    throw new Error('Invalid data type for fetchFile');
  }

  return new Uint8Array(buffer);
};
