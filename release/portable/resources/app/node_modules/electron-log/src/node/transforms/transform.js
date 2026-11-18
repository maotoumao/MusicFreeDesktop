'use strict';

module.exports = { transform };

function transform({
  logger,
  message,
  transport,

  initialData = message?.data || [],
  transforms = transport?.transforms,
}) {
  return transforms.reduce((data, trans) => {
    if (typeof trans === 'function') {
      return trans({ data, logger, message, transport });
    }

    return data;
  }, initialData);
}
