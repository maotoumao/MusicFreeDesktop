import { useRef, useState } from "react";

export default function useStateRef<T>(initValue: T) {
  const [state, setState] = useState(initValue);
  const ref = useRef(initValue);

  ref.current = state;

  return [state, setState, ref] as const;
}
