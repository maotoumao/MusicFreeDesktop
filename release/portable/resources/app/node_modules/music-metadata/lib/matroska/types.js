export var DataType;
(function (DataType) {
    DataType[DataType["string"] = 0] = "string";
    DataType[DataType["uint"] = 1] = "uint";
    DataType[DataType["uid"] = 2] = "uid";
    DataType[DataType["bool"] = 3] = "bool";
    DataType[DataType["binary"] = 4] = "binary";
    DataType[DataType["float"] = 5] = "float";
})(DataType || (DataType = {}));
export var TargetType;
(function (TargetType) {
    TargetType[TargetType["shot"] = 10] = "shot";
    TargetType[TargetType["scene"] = 20] = "scene";
    TargetType[TargetType["track"] = 30] = "track";
    TargetType[TargetType["part"] = 40] = "part";
    TargetType[TargetType["album"] = 50] = "album";
    TargetType[TargetType["edition"] = 60] = "edition";
    TargetType[TargetType["collection"] = 70] = "collection";
})(TargetType || (TargetType = {}));
export var TrackType;
(function (TrackType) {
    TrackType[TrackType["video"] = 1] = "video";
    TrackType[TrackType["audio"] = 2] = "audio";
    TrackType[TrackType["complex"] = 3] = "complex";
    TrackType[TrackType["logo"] = 4] = "logo";
    TrackType[TrackType["subtitle"] = 17] = "subtitle";
    TrackType[TrackType["button"] = 18] = "button";
    TrackType[TrackType["control"] = 32] = "control";
})(TrackType || (TrackType = {}));
//# sourceMappingURL=types.js.map