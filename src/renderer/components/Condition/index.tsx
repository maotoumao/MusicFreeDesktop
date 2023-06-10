import React, { ReactNode } from "react";

interface IConditionProps {
  condition: any;
  truthy?: JSX.Element;
  falsy?: JSX.Element;
  children?: JSX.Element;
}

export default function Condition(props: IConditionProps) {
  const { condition, truthy, falsy, children } = props;
  return condition ? truthy ?? children : falsy;
}
