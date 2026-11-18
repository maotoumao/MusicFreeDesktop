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

var SingleByteCharSetProber = require('./sbcharsetprober');
var CharSetGroupProber = require('./charsetgroupprober');
var Win1255HebrewModel = require('./langhebrewmodel').Win1255HebrewModel;
var HebrewProber = require('./hebrewprober');
var cyrillicModels = require('./langcyrillicmodel');
var greekModels = require('./langgreekmodel');
var TIS620ThaiModel = require('./langthaimodel').TIS620ThaiModel;
var hungarianModels = require('./langhungarianmodel');
var bulgarianModels = require('./langbulgarianmodel')

function SBCSGroupProber() {
    CharSetGroupProber.apply(this);

    var self = this;

    function init() {
        self._mProbers = [
            new SingleByteCharSetProber(cyrillicModels.Win1251CyrillicModel),
            new SingleByteCharSetProber(cyrillicModels.Koi8rModel),
            new SingleByteCharSetProber(cyrillicModels.Latin5CyrillicModel),
            new SingleByteCharSetProber(cyrillicModels.MacCyrillicModel),
            new SingleByteCharSetProber(cyrillicModels.Ibm866Model),
            new SingleByteCharSetProber(cyrillicModels.Ibm855Model),
            new SingleByteCharSetProber(greekModels.Latin7GreekModel),
            new SingleByteCharSetProber(greekModels.Win1253GreekModel),
            new SingleByteCharSetProber(bulgarianModels.Latin5BulgarianModel),
            new SingleByteCharSetProber(bulgarianModels.Win1251BulgarianModel),
            new SingleByteCharSetProber(hungarianModels.Latin2HungarianModel),
            new SingleByteCharSetProber(hungarianModels.Win1250HungarianModel),
            new SingleByteCharSetProber(TIS620ThaiModel)
        ];
        var hebrewProber = new HebrewProber();
        var logicalHebrewProber = new SingleByteCharSetProber(Win1255HebrewModel, false, hebrewProber);
        var visualHebrewProber = new SingleByteCharSetProber(Win1255HebrewModel, true, hebrewProber);
        hebrewProber.setModelProbers(logicalHebrewProber, visualHebrewProber);
        self._mProbers.push(hebrewProber, logicalHebrewProber, visualHebrewProber);

        self._supportedCharsetNames = [];
        for (const prober of self._mProbers) {
            self._supportedCharsetNames.push(prober.getCharsetName())
        }

        self.reset();
    }

    this.getSupportedCharsetNames = function() {
        return  self._supportedCharsetNames;
    }

    init();
}
SBCSGroupProber.prototype = new CharSetGroupProber();

module.exports = SBCSGroupProber;
