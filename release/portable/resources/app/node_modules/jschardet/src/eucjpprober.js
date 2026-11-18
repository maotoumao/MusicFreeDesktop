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
var MultiByteCharSetProber = require('./mbcharsetprober');
var EUCJPDistributionAnalysis = require('./chardistribution').EUCJPDistributionAnalysis;
var EUCJPContextAnalysis = require('./jpcntx').EUCJPContextAnalysis;
var EUCJPSMModel = require('./mbcssm/eucjp');
var constants = require('./constants');
var logger = require('./logger');

function EUCJPProber() {
    MultiByteCharSetProber.apply(this);

    var self = this;

    function init() {
        self._mCodingSM = new CodingStateMachine(EUCJPSMModel);
        self._mDistributionAnalyzer = new EUCJPDistributionAnalysis();
        self._mContextAnalyzer = new EUCJPContextAnalysis();
        self.reset();
    }

    this.reset = function() {
        EUCJPProber.prototype.reset.apply(this);
        this._mContextAnalyzer.reset();
    }

    this.getCharsetName = function() {
        return "EUC-JP";
    }

    this.feed = function(aBuf) {
        var aLen = aBuf.length;
        for( var i = 0; i < aLen; i++ ) {
            var codingState = this._mCodingSM.nextState(aBuf[i]);
            if( codingState == constants.error ) {
                logger.log(this.getCharsetName() + " prober hit error at byte " + i + "\n");
                this._mState = constants.notMe;
                break;
            } else if( codingState == constants.itsMe ) {
                this._mState = constants.foundIt;
                break;
            } else if( codingState == constants.start ) {
                var charLen = this._mCodingSM.getCurrentCharLen();
                if( i == 0 ) {
                    this._mLastChar[1] = aBuf[0];
                    var lastCharStr = this._mLastChar.join('');
                    this._mContextAnalyzer.feed(lastCharStr, charLen);
                    this._mDistributionAnalyzer.feed(lastCharStr, charLen);
                } else {
                    this._mContextAnalyzer.feed(aBuf.slice(i-1,i+1), charLen);
                    this._mDistributionAnalyzer.feed(aBuf.slice(i-1,i+1), charLen);
                }
            }
        }

        this._mLastChar[0] = aBuf[aLen - 1];

        if( this.getState() == constants.detecting ) {
            if( this._mContextAnalyzer.gotEnoughData() &&
                this.getConfidence() > constants.SHORTCUT_THRESHOLD ) {
                this._mState = constants.foundIt;
            }
        }

        return this.getState();
    }

    this.getConfidence = function() {
        var contxtCf = this._mContextAnalyzer.getConfidence();
        var distribCf = this._mDistributionAnalyzer.getConfidence();

        return Math.max(contxtCf, distribCf);
    }

    init();
}
EUCJPProber.prototype = new MultiByteCharSetProber();

module.exports = EUCJPProber
