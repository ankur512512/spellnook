import { useGame } from "../store";
import { KeyboardView } from "./KeyboardView";

// Single-player keyboard: binds the presentational keyboard to the solo store.
export function Keyboard() {
  const { keyStatuses, addLetter, removeLetter, submit } = useGame();

  const onKey = (key: string) => {
    if (key === "enter") submit();
    else if (key === "back") removeLetter();
    else addLetter(key);
  };

  return <KeyboardView keyStatuses={keyStatuses} onKey={onKey} />;
}
