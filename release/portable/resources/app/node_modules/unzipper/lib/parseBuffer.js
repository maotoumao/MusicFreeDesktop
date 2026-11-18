const parseUIntLE = function(buffer, offset, size) {
  var result;
  switch(size) {
    case 1:
      result = buffer.readUInt8(offset);
      break;
    case 2:
      result = buffer.readUInt16LE(offset);
      break;
    case 4:
      result = buffer.readUInt32LE(offset);
      break;
    case 8:
      result = Number(buffer.readBigUInt64LE(offset));
      break;
    default:
     throw new Error('Unsupported UInt LE size!');
  }
  return result;
}

/**
 * Parses sequential unsigned little endian numbers from the head of the passed buffer according to
 * the specified format passed.  If the buffer is not large enough to satisfy the full format,
 * null values will be assigned to the remaining keys.
 * @param {*} buffer The buffer to sequentially extract numbers from.
 * @param {*} format Expected format to follow when extrcting values from the buffer.  A list of list entries
 * with the following structure:
 * [
 *   [
 *     <key>,  // Name of the key to assign the extracted number to.
 *     <size>  // The size in bytes of the number to extract. possible values are 1, 2, 4, 8.
 *   ],
 *   ...
 * ]
 * @returns An object with keys set to their associated extracted values.
 */
const parse = function(buffer, format) {
  var result = {}
  var offset = 0;
  for(const [key, size] of format) {
    if(buffer.length >= offset + size) {
      result[key] = parseUIntLE(buffer, offset, size);
    }
    else {
      result[key] = null;
    }
    offset += size;
  }
  return result;
}

module.exports = {
  parse
}