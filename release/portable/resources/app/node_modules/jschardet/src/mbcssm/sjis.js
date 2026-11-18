var consts = require('../constants');

var SJIS_cls = [
    1,1,1,1,1,1,1,1,  // 00 - 07
    1,1,1,1,1,1,0,0,  // 08 - 0f
    1,1,1,1,1,1,1,1,  // 10 - 17
    1,1,1,0,1,1,1,1,  // 18 - 1f
    1,1,1,1,1,1,1,1,  // 20 - 27
    1,1,1,1,1,1,1,1,  // 28 - 2f
    1,1,1,1,1,1,1,1,  // 30 - 37
    1,1,1,1,1,1,1,1,  // 38 - 3f
    2,2,2,2,2,2,2,2,  // 40 - 47
    2,2,2,2,2,2,2,2,  // 48 - 4f
    2,2,2,2,2,2,2,2,  // 50 - 57
    2,2,2,2,2,2,2,2,  // 58 - 5f
    2,2,2,2,2,2,2,2,  // 60 - 67
    2,2,2,2,2,2,2,2,  // 68 - 6f
    2,2,2,2,2,2,2,2,  // 70 - 77
    2,2,2,2,2,2,2,1,  // 78 - 7f
    3,3,3,3,3,3,3,3,  // 80 - 87
    3,3,3,3,3,3,3,3,  // 88 - 8f
    3,3,3,3,3,3,3,3,  // 90 - 97
    3,3,3,3,3,3,3,3,  // 98 - 9f
    // 0xa0 is illegal in sjis encoding, but some pages does
    // contain such byte. We need to be more consts.error forgiven.
    2,2,2,2,2,2,2,2,  // a0 - a7
    2,2,2,2,2,2,2,2,  // a8 - af
    2,2,2,2,2,2,2,2,  // b0 - b7
    2,2,2,2,2,2,2,2,  // b8 - bf
    2,2,2,2,2,2,2,2,  // c0 - c7
    2,2,2,2,2,2,2,2,  // c8 - cf
    2,2,2,2,2,2,2,2,  // d0 - d7
    2,2,2,2,2,2,2,2,  // d8 - df
    3,3,3,3,3,3,3,3,  // e0 - e7
    3,3,3,3,3,4,4,4,  // e8 - ef
    3,3,3,3,3,3,3,3,  // f0 - f7
    3,3,3,3,3,0,0,0   // f8 - ff
];

var SJIS_st = [
    consts.error,consts.start,consts.start,    3,consts.error,consts.error,consts.error,consts.error, //00-07
    consts.error,consts.error,consts.error,consts.error,consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe, //08-0f
    consts.itsMe,consts.itsMe,consts.error,consts.error,consts.start,consts.start,consts.start,consts.start  //10-17
];

var SJISCharLenTable = [0, 1, 1, 2, 0, 0];

module.exports = {
    "classTable"    : SJIS_cls,
    "classFactor"   : 6,
    "stateTable"    : SJIS_st,
    "charLenTable"  : SJISCharLenTable,
    "name"          : "Shift_JIS"
};
