import _extends from "@babel/runtime/helpers/esm/extends";
import _objectSpread from "@babel/runtime/helpers/esm/objectSpread2";
import _slicedToArray from "@babel/runtime/helpers/esm/slicedToArray";
import _objectWithoutProperties from "@babel/runtime/helpers/esm/objectWithoutProperties";
var _excluded = ["prefixCls", "style", "onStartMove", "onOffsetChange", "values", "handleRender", "activeHandleRender", "draggingIndex", "onFocus"];
import * as React from 'react';
import { getIndex } from "../util";
import Handle from "./Handle";
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
    restProps = _objectWithoutProperties(props, _excluded);
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
    _React$useState2 = _slicedToArray(_React$useState, 2),
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
  var handleProps = _objectSpread({
    prefixCls: prefixCls,
    onStartMove: onStartMove,
    onOffsetChange: onOffsetChange,
    render: handleRender,
    onFocus: onHandleFocus,
    onMouseEnter: onHandleMouseEnter
  }, restProps);
  return /*#__PURE__*/React.createElement(React.Fragment, null, values.map(function (value, index) {
    return /*#__PURE__*/React.createElement(Handle, _extends({
      ref: function ref(node) {
        if (!node) {
          delete handlesRef.current[index];
        } else {
          handlesRef.current[index] = node;
        }
      },
      dragging: draggingIndex === index,
      style: getIndex(style, index),
      key: index,
      value: value,
      valueIndex: index
    }, handleProps));
  }), activeHandleRender && /*#__PURE__*/React.createElement(Handle, _extends({
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
export default Handles;