"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "Trans", {
  enumerable: true,
  get: function get() {
    return _Trans.Trans;
  }
});
Object.defineProperty(exports, "TransWithoutContext", {
  enumerable: true,
  get: function get() {
    return _TransWithoutContext.Trans;
  }
});
Object.defineProperty(exports, "useTranslation", {
  enumerable: true,
  get: function get() {
    return _useTranslation.useTranslation;
  }
});
Object.defineProperty(exports, "withTranslation", {
  enumerable: true,
  get: function get() {
    return _withTranslation.withTranslation;
  }
});
Object.defineProperty(exports, "Translation", {
  enumerable: true,
  get: function get() {
    return _Translation.Translation;
  }
});
Object.defineProperty(exports, "I18nextProvider", {
  enumerable: true,
  get: function get() {
    return _I18nextProvider.I18nextProvider;
  }
});
Object.defineProperty(exports, "withSSR", {
  enumerable: true,
  get: function get() {
    return _withSSR.withSSR;
  }
});
Object.defineProperty(exports, "useSSR", {
  enumerable: true,
  get: function get() {
    return _useSSR.useSSR;
  }
});
Object.defineProperty(exports, "initReactI18next", {
  enumerable: true,
  get: function get() {
    return _initReactI18next.initReactI18next;
  }
});
Object.defineProperty(exports, "setDefaults", {
  enumerable: true,
  get: function get() {
    return _defaults.setDefaults;
  }
});
Object.defineProperty(exports, "getDefaults", {
  enumerable: true,
  get: function get() {
    return _defaults.getDefaults;
  }
});
Object.defineProperty(exports, "setI18n", {
  enumerable: true,
  get: function get() {
    return _i18nInstance.setI18n;
  }
});
Object.defineProperty(exports, "getI18n", {
  enumerable: true,
  get: function get() {
    return _i18nInstance.getI18n;
  }
});
Object.defineProperty(exports, "I18nContext", {
  enumerable: true,
  get: function get() {
    return _context.I18nContext;
  }
});
Object.defineProperty(exports, "composeInitialProps", {
  enumerable: true,
  get: function get() {
    return _context.composeInitialProps;
  }
});
Object.defineProperty(exports, "getInitialProps", {
  enumerable: true,
  get: function get() {
    return _context.getInitialProps;
  }
});
exports.selectOrdinal = exports.plural = exports.select = exports.number = exports.time = exports.date = void 0;

var _Trans = require("./Trans.js");

var _TransWithoutContext = require("./TransWithoutContext.js");

var _useTranslation = require("./useTranslation.js");

var _withTranslation = require("./withTranslation.js");

var _Translation = require("./Translation.js");

var _I18nextProvider = require("./I18nextProvider.js");

var _withSSR = require("./withSSR.js");

var _useSSR = require("./useSSR.js");

var _initReactI18next = require("./initReactI18next.js");

var _defaults = require("./defaults.js");

var _i18nInstance = require("./i18nInstance.js");

var _context = require("./context.js");

var date = function date() {
  return '';
};

exports.date = date;

var time = function time() {
  return '';
};

exports.time = time;

var number = function number() {
  return '';
};

exports.number = number;

var select = function select() {
  return '';
};

exports.select = select;

var plural = function plural() {
  return '';
};

exports.plural = plural;

var selectOrdinal = function selectOrdinal() {
  return '';
};

exports.selectOrdinal = selectOrdinal;