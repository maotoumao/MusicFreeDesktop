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

var constants = require('./constants')

function CharSetProber() {
    this.reset = function() {
        this._mState = constants.detecting;
    }

    this.getCharsetName = function() {
        return null;
    }

    this.getSupportedCharsetNames = function() {
      throw new Error("Unimplemented method getSupportedCharsetNames()");
    }

    this.feed = function(aBuf) {
    }

    this.getState = function() {
        return this._mState;
    }

    this.getConfidence = function() {
        return 0.0;
    }

    this.filterHighBitOnly = function(aBuf) {
        aBuf = aBuf.replace(/[\x00-\x7F]+/g, " ");
        return aBuf;
    }

    this.filterWithoutEnglishLetters = function(aBuf) {
        aBuf = aBuf.replace(/[A-Za-z]+/g, " ");
        return aBuf;
    }

    // Returns a copy of aBuf that retains only the sequences of English
    // alphabet and high byte characters that are not between <> characters.
    // The exception are PHP tags which start with '<?' and end with '?>'.
    // This filter can be applied to all scripts which contain both English
    // characters and extended ASCII characters, but is currently only used by
    // Latin1Prober.
    this.removeXmlTags = function(aBuf) {
        var result = '';
        var inTag = false;
        var prev = 0;

        for (var curr = 0; curr < aBuf.length; curr++) {
            var c = aBuf[curr];

            if (c == '>' && aBuf[curr-1] !== '?') {
                prev = curr + 1
                inTag = false;
            } else if (c == '<' && aBuf[curr+1] !== '?') {
                if (curr > prev && !inTag) {
                    result = result + aBuf.substring(prev, curr) + ' ';
                }
                inTag = true;
            }
        }

        if (!inTag) {
          result = result + aBuf.substring(prev);
        }

        return result;
    }
}

module.exports = CharSetProber
