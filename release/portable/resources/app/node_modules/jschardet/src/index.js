/*
 * The Original Code is Mozilla Universal charset detector code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   António Afonso (antonio.afonso gmail.com) - port to JavaScript
 *   Mark Pilgrim - port to Python
 *   Shy Shalom - original C code
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301  USA
 */

var UniversalDetector = require('./universaldetector');
var setLogger = require('./logger').setLogger;

exports.detect = function(buffer, options) {
    var u = runUniversalDetector(buffer, options);
    return u.result;
}
exports.detectAll = function(buffer, options) {
    var u = runUniversalDetector(buffer, options);
    return u.results;
}
exports.UniversalDetector = UniversalDetector;
exports.enableDebug = function() {
    setLogger(console.log.bind(console));
}

function runUniversalDetector(buffer, options) {
    var u = new UniversalDetector(options);
    u.reset();
    if( typeof Buffer == 'function' && buffer instanceof Buffer ) {
        u.feed(buffer.toString('binary'));
    } else {
        u.feed(buffer);
    }
    u.close();
    return u;
}