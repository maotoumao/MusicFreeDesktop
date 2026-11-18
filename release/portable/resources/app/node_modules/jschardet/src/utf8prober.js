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

var CodingStateMachine = require('./codingstatemachine');
var CharSetProber = require('./charsetprober');
var constants = require('./constants');
var UTF8SMModel = require('./mbcssm/utf8');

function UTF8Prober() {
    CharSetProber.apply(this);

    var ONE_CHAR_PROB = 0.5;
    var self = this;

    function init() {
        self._mCodingSM = new CodingStateMachine(UTF8SMModel);
        self.reset();
    }

    this.reset = function() {
        UTF8Prober.prototype.reset.apply(this);
        this._mCodingSM.reset();
        this._mNumOfMBChar = 0;
        this._mMBCharLen = 0;
        this._mFullLen = 0;
        this._mBasicAsciiLen = 0;
    }

    this.getCharsetName = function() {
        return "UTF-8";
    }

    this.feed = function(aBuf) {
        this._mFullLen += aBuf.length;
        for( var i = 0, c; i < aBuf.length; i++ ) {
            c = aBuf[i];
            var codingState = this._mCodingSM.nextState(c);
            if( codingState == constants.error ) {
                this._mState = constants.notMe;
                break;
            } else if( codingState == constants.itsMe ) {
                this._mState = constants.foundIt;
                break;
            } else if( codingState == constants.start ) {
                if( this._mCodingSM.getCurrentCharLen() >= 2 ) {
                    this._mNumOfMBChar++;
                    this._mMBCharLen += this._mCodingSM.getCurrentCharLen();
                } else if( c.charCodeAt(0) < 128 ) { // codes higher than 127 are extended ASCII
                    this._mBasicAsciiLen++;
                }
            }
        }

        if( this.getState() == constants.detecting ) {
            if( this.getConfidence() > constants.SHORTCUT_THRESHOLD ) {
                this._mState = constants.foundIt;
            }
        }

        return this.getState();
    }

    this.getConfidence = function() {
        var unlike = 0.99;
        var mbCharRatio = 0;
        var nonBasciAsciiLen = (this._mFullLen - this._mBasicAsciiLen);
        if( nonBasciAsciiLen > 0 ) {
            mbCharRatio = this._mMBCharLen / nonBasciAsciiLen;
        }
        if( this._mNumOfMBChar < 6 && mbCharRatio <= 0.6 ) {
            unlike *= Math.pow(ONE_CHAR_PROB, this._mNumOfMBChar);
            return 1 - unlike;
        } else {
            return unlike;
        }
    }

    init();
}
UTF8Prober.prototype = new CharSetProber();

module.exports = UTF8Prober;
