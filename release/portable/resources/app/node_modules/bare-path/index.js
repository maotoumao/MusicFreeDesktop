/* global Bare */
const posix = require('./lib/posix')
const win32 = require('./lib/win32')

module.exports = Bare.platform === 'win32' ? win32 : posix
