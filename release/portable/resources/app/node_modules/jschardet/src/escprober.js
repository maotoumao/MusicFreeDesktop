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

var CharSetProber = require('./charsetprober');
var CodingStateMachine = require('./codingstatemachine');
var escsm = require('./escsm');
var constants = require('./constants');

function EscCharSetProber() {
    CharSetProber.apply(this);

    var self = this;

    function init() {
        self._mCodingSM = [
            new CodingStateMachine(escsm.HZSMModel),
            new CodingStateMachine(escsm.ISO2022CNSMModel),
            new CodingStateMachine(escsm.ISO2022JPSMModel),
            new CodingStateMachine(escsm.ISO2022KRSMModel)
        ];
        self._supportedCharsetNames = [];
        for (const codingSM of self._mCodingSM) {
            self._supportedCharsetNames.push(codingSM.getCodingStateMachine());
        }
        self.reset();
    }

    this.reset = function() {
        EscCharSetProber.prototype.reset.apply(this);
        for( var i = 0, codingSM; codingSM = this._mCodingSM[i]; i++ ) {
            if( !codingSM ) continue;
            codingSM.active = true;
            codingSM.reset();
        }
        this._mActiveSM = self._mCodingSM.length;
        this._mDetectedCharset = null;
    }

    this.getCharsetName = function() {
        return this._mDetectedCharset;
    }

    this.getSupportedCharsetNames = function() {
        return self._supportedCharsetNames;
    }

    this.getConfidence = function() {
        if( this._mDetectedCharset ) {
            return 0.99;
        } else {
            return 0.00;
        }
    }

    this.feed = function(aBuf) {
        for( var i = 0, c; i < aBuf.length; i++ ) {
            c = aBuf[i];
            for( var j = 0, codingSM; codingSM = this._mCodingSM[j]; j++ ) {
                if( !codingSM || !codingSM.active ) continue;
                var codingState = codingSM.nextState(c);
                if( codingState == constants.error ) {
                    codingSM.active = false;
                    this._mActiveSM--;
                    if( this._mActiveSM <= 0 ) {
                        this._mState = constants.notMe;
                        return this.getState();
                    }
                } else if( codingState == constants.itsMe ) {
                    this._mState = constants.foundIt;
                    this._mDetectedCharset = codingSM.getCodingStateMachine();
                    return this.getState();
                }
            }
        }

        return this.getState();
    }

    init();
}
EscCharSetProber.prototype = new CharSetProber();

module.exports = EscCharSetProber
