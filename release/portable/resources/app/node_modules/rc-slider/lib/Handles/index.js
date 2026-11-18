"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _extends2 = _interopRequireDefault(require("@babel/runtime/helpers/extends"));
var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread2"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var React = _interopRequireWildcard(require("react"));
var _util = require("../util");
var _Handle = _interopRequireDefault(require("./Handle"));
var _excluded = ["prefixCls", "style", "onStartMove", "onOffsetChange", "values", "handleRender", "activeHandleRender", "draggingIndex", "onFocus"];
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != _typeof(e) && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
var Handles = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var prefixCls = props.prefixCls,
    style = props.style,
    onStartMove = props.onStartMove,
    onOffsetChange = props.onOffsetChange,
    values = props.values,
    handleRender = props.handleRender,
    activeHandleRender = props.activeHandleRender,
    draggingIndex = props.draggingIndex,
    onFocus = props.onFocus,
    restProps = (0, _objectWithoutProperties2.default)(props, _excluded);
  var handlesRef = React.useRef({});
  React.useImperativeHandle(ref, function () {
    return {
      focus: function focus(index) {
        var _handlesRef$current$i;
        (_handlesRef$current$i = handlesRef.current[index]) === null || _handlesRef$current$i === void 0 || _handlesRef$current$i.focus();
      }
    };
  });

  // =========================== Active ===========================
  var _React$useState = React.useState(-1),
    _React$useState2 = (0, _slicedToArray2.default)(_React$useState, 2),
    activeIndex = _React$useState2[0],
    setActiveIndex = _React$useState2[1];
  var onHandleFocus = function onHandleFocus(e, index) {
    setActiveIndex(index);
    onFocus === null || onFocus === void 0 || onFocus(e);
  };
  var onHandleMouseEnter = function onHandleMouseEnter(e, index) {
    setActiveIndex(index);
  };

  // =========================== Render ===========================
  // Handle Props
  var handleProps = (0, _objectSpread2.default)({
    prefixCls: prefixCls,
    onStartMove: onStartMove,
    onOffsetChange: onOffsetChange,
    render: handleRender,
    onFocus: onHandleFocus,
    onMouseEnter: onHandleMouseEnter
  }, restProps);
  return /*#__PURE__*/React.createElement(React.Fragment, null, values.map(function (value, index) {
    return /*#__PURE__*/React.createElement(_Handle.default, (0, _extends2.default)({
      ref: function ref(node) {
        if (!node) {
          delete handlesRef.current[index];
        } else {
          handlesRef.current[index] = node;
        }
      },
      dragging: draggingIndex === index,
      style: (0, _util.getIndex)(style, index),
      key: index,
      value: value,
      valueIndex: index
    }, handleProps));
  }), activeHandleRender && /*#__PURE__*/React.createElement(_Handle.default, (0, _extends2.default)({
    key: "a11y"
  }, handleProps, {
    value: values[activeIndex],
    valueIndex: null,
    dragging: draggingIndex !== -1,
    render: activeHandleRender,
    style: {
      pointerEvents: 'none'
    },
    tabIndex: null,
    "aria-hidden": true
  })));
});
if (process.env.NODE_ENV !== 'production') {
  Handles.displayName = 'Handles';
}
var _default = exports.default = Handles;