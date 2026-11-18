// By default, do nothing
exports.log = function () {};

exports.setLogger = function setLogger(loggerFunction) {
  exports.enabled = true;
  exports.log = loggerFunction;
};
