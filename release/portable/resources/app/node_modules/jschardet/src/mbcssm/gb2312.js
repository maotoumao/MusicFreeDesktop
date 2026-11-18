var consts = require('../constants');

var GB2312_cls = [
    1,1,1,1,1,1,1,1,  // 00 - 07
    1,1,1,1,1,1,0,0,  // 08 - 0f
    1,1,1,1,1,1,1,1,  // 10 - 17
    1,1,1,0,1,1,1,1,  // 18 - 1f
    1,1,1,1,1,1,1,1,  // 20 - 27
    1,1,1,1,1,1,1,1,  // 28 - 2f
    3,3,3,3,3,3,3,3,  // 30 - 37
    3,3,1,1,1,1,1,1,  // 38 - 3f
    2,2,2,2,2,2,2,2,  // 40 - 47
    2,2,2,2,2,2,2,2,  // 48 - 4f
    2,2,2,2,2,2,2,2,  // 50 - 57
    2,2,2,2,2,2,2,2,  // 58 - 5f
    2,2,2,2,2,2,2,2,  // 60 - 67
    2,2,2,2,2,2,2,2,  // 68 - 6f
    2,2,2,2,2,2,2,2,  // 70 - 77
    2,2,2,2,2,2,2,4,  // 78 - 7f
    5,6,6,6,6,6,6,6,  // 80 - 87
    6,6,6,6,6,6,6,6,  // 88 - 8f
    6,6,6,6,6,6,6,6,  // 90 - 97
    6,6,6,6,6,6,6,6,  // 98 - 9f
    6,6,6,6,6,6,6,6,  // a0 - a7
    6,6,6,6,6,6,6,6,  // a8 - af
    6,6,6,6,6,6,6,6,  // b0 - b7
    6,6,6,6,6,6,6,6,  // b8 - bf
    6,6,6,6,6,6,6,6,  // c0 - c7
    6,6,6,6,6,6,6,6,  // c8 - cf
    6,6,6,6,6,6,6,6,  // d0 - d7
    6,6,6,6,6,6,6,6,  // d8 - df
    6,6,6,6,6,6,6,6,  // e0 - e7
    6,6,6,6,6,6,6,6,  // e8 - ef
    6,6,6,6,6,6,6,6,  // f0 - f7
    6,6,6,6,6,6,6,0   // f8 - ff
];

var GB2312_st = [
    consts.error,consts.start,consts.start,consts.start,consts.start,consts.start,    3,consts.error, //00-07
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.itsMe,consts.itsMe, //08-0f
    consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe,consts.error,consts.error,consts.start, //10-17
        4,consts.error,consts.start,consts.start,consts.error,consts.error,consts.error,consts.error, //18-1f
    consts.error,consts.error,    5,consts.error,consts.error,consts.error,consts.itsMe,consts.error, //20-27
    consts.error,consts.error,consts.start,consts.start,consts.start,consts.start,consts.start,consts.start  //28-2f
];

// To be accurate, the length of class 6 can be either 2 or 4.
// But it is not necessary to discriminate between the two since
// it is used for frequency analysis only, and we are validing
// each code range there as well. So it is safe to set it to be
// 2 here.
var GB2312CharLenTable = [0, 1, 1, 1, 1, 1, 2];

module.exports = {
    "classTable"    : GB2312_cls,
    "classFactor"   : 7,
    "stateTable"    : GB2312_st,
    "charLenTable"  : GB2312CharLenTable,
    "name"          : "GB2312"
};
