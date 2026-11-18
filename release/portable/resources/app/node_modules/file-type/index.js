import * as strtok3 from 'strtok3';
import {FileTypeParser} from './core.js';

export async function fileTypeFromFile(path, fileTypeOptions) {
	const tokenizer = await strtok3.fromFile(path);
	try {
		const parser = new FileTypeParser(fileTypeOptions);
		return await parser.fromTokenizer(tokenizer);
	} finally {
		await tokenizer.close();
	}
}

export * from './core.js';
