'use strict';

module.exports = scopeFactory;

function scopeFactory(logger) {
  return Object.defineProperties(scope, {
    defaultLabel: { value: '', writable: true },
    labelPadding: { value: true, writable: true },
    maxLabelLength: { value: 0, writable: true },
    labelLength: {
      get() {
        switch (typeof scope.labelPadding) {
          case 'boolean': return scope.labelPadding ? scope.maxLabelLength : 0;
          case 'number': return scope.labelPadding;
          default: return 0;
        }
      },
    },
  });

  function scope(label) {
    scope.maxLabelLength = Math.max(scope.maxLabelLength, label.length);

    const newScope = {};
    for (const level of [...logger.levels, 'log']) {
      newScope[level] = (...d) => logger.logData(d, { level, scope: label });
    }
    return newScope;
  }
}
