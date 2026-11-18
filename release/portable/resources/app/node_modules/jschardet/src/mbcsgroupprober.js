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

var CharSetGroupProber = require('./charsetgroupprober');
var Big5Prober = require('./big5prober');
var UTF8Prober = require('./utf8prober');
var SJISProber = require('./sjisprober');
var EUCJPProber = require('./eucjpprober');
var GB2312Prober = require('./gb2312prober');
var EUCKRProber = require('./euckrprober');
var EUCTWProber = require('./euctwprober');

function MBCSGroupProber() {
    CharSetGroupProber.apply(this);
    this._mProbers = [
        new UTF8Prober(),
        new SJISProber(),
        new EUCJPProber(),
        new GB2312Prober(),
        new EUCKRProber(),
        new Big5Prober(),
        new EUCTWProber()
    ];
    const supportedCharsetNames = this._mProbers.map(prober => prober.getCharsetName());
    this.getSupportedCharsetNames = function() {
        return supportedCharsetNames;
    }
    this.reset();
}
MBCSGroupProber.prototype = new CharSetGroupProber();

module.exports = MBCSGroupProber
