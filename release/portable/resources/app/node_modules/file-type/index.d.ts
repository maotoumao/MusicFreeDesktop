import type {FileTypeResult} from './core.js';

/**
Detect the file type of a file path.

The file type is detected by checking the [magic number](https://en.wikipedia.org/wiki/Magic_number_(programming)#Magic_numbers_in_files) of the buffer.

@param path - The file path to parse.
@returns The detected file type and MIME type or `undefined` when there is no match.
*/
export function fileTypeFromFile(path: string): Promise<FileTypeResult | undefined>;

export * from './core.js';
