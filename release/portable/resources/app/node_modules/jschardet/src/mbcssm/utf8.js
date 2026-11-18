var consts = require('../constants');

var UTF8_cls = [
    1,1,1,1,1,1,1,1,  // 00 - 07  //allow 0x00 as a legal value
    1,1,1,1,1,1,0,0,  // 08 - 0f
    1,1,1,1,1,1,1,1,  // 10 - 17
    1,1,1,0,1,1,1,1,  // 18 - 1f
    1,1,1,1,1,1,1,1,  // 20 - 27
    1,1,1,1,1,1,1,1,  // 28 - 2f
    1,1,1,1,1,1,1,1,  // 30 - 37
    1,1,1,1,1,1,1,1,  // 38 - 3f
    1,1,1,1,1,1,1,1,  // 40 - 47
    1,1,1,1,1,1,1,1,  // 48 - 4f
    1,1,1,1,1,1,1,1,  // 50 - 57
    1,1,1,1,1,1,1,1,  // 58 - 5f
    1,1,1,1,1,1,1,1,  // 60 - 67
    1,1,1,1,1,1,1,1,  // 68 - 6f
    1,1,1,1,1,1,1,1,  // 70 - 77
    1,1,1,1,1,1,1,1,  // 78 - 7f
    2,2,2,2,3,3,3,3,  // 80 - 87
    4,4,4,4,4,4,4,4,  // 88 - 8f
    4,4,4,4,4,4,4,4,  // 90 - 97
    4,4,4,4,4,4,4,4,  // 98 - 9f
    5,5,5,5,5,5,5,5,  // a0 - a7
    5,5,5,5,5,5,5,5,  // a8 - af
    5,5,5,5,5,5,5,5,  // b0 - b7
    5,5,5,5,5,5,5,5,  // b8 - bf
    0,0,6,6,6,6,6,6,  // c0 - c7
    6,6,6,6,6,6,6,6,  // c8 - cf
    6,6,6,6,6,6,6,6,  // d0 - d7
    6,6,6,6,6,6,6,6,  // d8 - df
    7,8,8,8,8,8,8,8,  // e0 - e7
    8,8,8,8,8,9,8,8,  // e8 - ef
    10,11,11,11,11,11,11,11,  // f0 - f7
    12,13,13,13,14,15,0,0    // f8 - ff
];

var UTF8_st = [
    consts.error,consts.start,consts.error,consts.error,consts.error,consts.error,    12,  10, //00-07
        9,    11,    8,    7,    6,    5,    4,   3, //08-0f
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //10-17
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //18-1f
    consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe, //20-27
    consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe,consts.itsMe, //28-2f
    consts.error,consts.error,    5,    5,    5,    5,consts.error,consts.error, //30-37
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //38-3f
    consts.error,consts.error,consts.error,    5,    5,    5,consts.error,consts.error, //40-47
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //48-4f
    consts.error,consts.error,    7,    7,    7,    7,consts.error,consts.error, //50-57
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //58-5f
    consts.error,consts.error,consts.error,consts.error,    7,    7,consts.error,consts.error, //60-67
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //68-6f
    consts.error,consts.error,    9,    9,    9,    9,consts.error,consts.error, //70-77
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //78-7f
    consts.error,consts.error,consts.error,consts.error,    9,    9,consts.error,consts.error, //80-87
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //88-8f
    consts.error,consts.error,   12,   12,   12,   12,consts.error,consts.error, //90-97
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //98-9f
    consts.error,consts.error,consts.error,consts.error,consts.error,   12,consts.error,consts.error, //a0-a7
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //a8-af
    consts.error,consts.error,   12,   12,   12,consts.error,consts.error,consts.error, //b0-b7
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error, //b8-bf
    consts.error,consts.error,consts.start,consts.start,consts.start,consts.start,consts.error,consts.error, //c0-c7
    consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error,consts.error  //c8-cf
];

var UTF8CharLenTable = [0, 1, 0, 0, 0, 0, 2, 3, 3, 3, 4, 4, 5, 5, 6, 6];

module.exports = {
    "classTable"    : UTF8_cls,
    "classFactor"   : 16,
    "stateTable"    : UTF8_st,
    "charLenTable"  : UTF8CharLenTable,
    "name"          : "UTF-8"
};
