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
