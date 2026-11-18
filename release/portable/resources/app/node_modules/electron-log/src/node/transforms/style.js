'use strict';

module.exports = {
  transformStyles,

  applyAnsiStyles({ data }) {
    return transformStyles(data, styleToAnsi, resetAnsiStyle);
  },

  removeStyles({ data }) {
    return transformStyles(data, () => '');
  },
};

const ANSI_COLORS = {
  unset: '\x1b[0m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function styleToAnsi(style) {
  const color = style.replace(/color:\s*(\w+).*/, '$1').toLowerCase();
  return ANSI_COLORS[color] || '';
}

function resetAnsiStyle(string) {
  return string + ANSI_COLORS.unset;
}

function transformStyles(data, onStyleFound, onStyleApplied) {
  const foundStyles = {};

  return data.reduce((result, item, index, array) => {
    if (foundStyles[index]) {
      return result;
    }

    if (typeof item === 'string') {
      let valueIndex = index;
      let styleApplied = false;

      item = item.replace(/%[1cdfiOos]/g, (match) => {
        valueIndex += 1;

        if (match !== '%c') {
          return match;
        }

        const style = array[valueIndex];
        if (typeof style === 'string') {
          foundStyles[valueIndex] = true;
          styleApplied = true;
          return onStyleFound(style, item);
        }

        return match;
      });

      if (styleApplied && onStyleApplied) {
        item = onStyleApplied(item);
      }
    }

    result.push(item);
    return result;
  }, []);
}
