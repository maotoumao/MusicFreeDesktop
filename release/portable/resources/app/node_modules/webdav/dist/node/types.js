export { Request, Response } from "@buttercup/fetch";
export var AuthType;
(function (AuthType) {
    AuthType["Auto"] = "auto";
    AuthType["Digest"] = "digest";
    AuthType["None"] = "none";
    AuthType["Password"] = "password";
    AuthType["Token"] = "token";
})(AuthType || (AuthType = {}));
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["DataTypeNoLength"] = "data-type-no-length";
    ErrorCode["InvalidAuthType"] = "invalid-auth-type";
    ErrorCode["InvalidOutputFormat"] = "invalid-output-format";
    ErrorCode["LinkUnsupportedAuthType"] = "link-unsupported-auth";
    ErrorCode["InvalidUpdateRange"] = "invalid-update-range";
    ErrorCode["NotSupported"] = "not-supported";
})(ErrorCode || (ErrorCode = {}));
