'use strict';
const path = require('path');
const fs = require('fs');

const dest = process.argv[2];
const source = path.resolve(path.sep, process.argv[3] || path.join(__dirname, 'sqlite3'));
const files = [
	{ filename: 'sqlite3.c', optional: false },
	{ filename: 'sqlite3.h', optional: false },
];

if (process.argv[3]) {
	// Support "_HAVE_SQLITE_CONFIG_H" in custom builds.
	files.push({ filename: 'config.h', optional: true });
} else {
	// Required for some tests.
	files.push({ filename: 'sqlite3ext.h', optional: false });
}

for (const { filename, optional } of files) {
	const sourceFilepath = path.join(source, filename);
	const destFilepath = path.join(dest, filename);

	if (optional && !fs.existsSync(sourceFilepath)) {
		continue;
	}

	fs.accessSync(sourceFilepath);
	fs.mkdirSync(path.dirname(destFilepath), { recursive: true });
	fs.copyFileSync(sourceFilepath, destFilepath);
}
