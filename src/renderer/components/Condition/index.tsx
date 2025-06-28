import { ReactNode } from "react";

interface IConditionProps {
  condition: any;
  truthy?: ReactNode;
  falsy?: ReactNode;
  children?: ReactNode;
}

export default function Condition(props: IConditionProps) {
  const { condition, truthy, falsy, children } = props;
  return <>{condition ? truthy ?? children : falsy}</>;
}

interface IIfProps {
  condition: any;
  children?: any;
}

interface ICondProps {
  children?: ReactNode | ReactNode[];
}
function Truthy(props: ICondProps) {
  return <>{props?.children}</>;
}

function Falsy(props: ICondProps) {
  return <>{props?.children}</>;
}

function If(props: IIfProps) {
  const { condition, children } = props;

  if (!children) {
    return null;
  }

  let _children: any;
  if (Array.isArray) {
    _children = children.map((it: any) =>
      condition
        ? it.type !== Falsy
          ? it
          : null
        : it.type !== Truthy
        ? it
        : null
    );
  } else {
    _children = condition
      ? _children!.type !== Falsy
        ? _children
        : null
      : _children.type !== Truthy
      ? _children
      : null;
  }

  return _children;
}

If.Truthy = Truthy;
If.Falsy = Falsy;


function IfTruthy(props: IIfProps) {
  const { condition, children } = props;

  return condition ? children : null;
}

function IfFalsy(props: IIfProps) {
  const { condition, children } = props;

  return condition ? null : children;
}

export { If, IfTruthy, IfFalsy };
