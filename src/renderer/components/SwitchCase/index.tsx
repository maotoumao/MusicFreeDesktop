import { ReactElement } from "react";

interface ISwitchProps {
  switch: any;
  children: any;
}

function Switch(props: ISwitchProps){
  const { switch: _switch, children } = props;

  if (Array.isArray(children)) {
    const validChildren = children.filter(
      (child) => child.props?.case === _switch
    );
    return validChildren as ReactElement[];
  }
  return children.props?.case === _switch ? children : null;
}

interface ICaseProps {
  case: any;
  children: any;
}
function Case(props: ICaseProps) {
  const { case: _case, children } = props;
  return children;
}

const SwitchCase = {
  Switch,
  Case,
};

export default SwitchCase;
