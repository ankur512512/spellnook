import type { LetterStatus } from "../types";

interface Props {
  letter: string;
  status: LetterStatus;
  // Reveal index used to stagger the flip animation across a row.
  revealDelay?: number;
  revealed?: boolean;
}

export function Tile({ letter, status, revealDelay = 0, revealed = false }: Props) {
  const cls = ["tile"];
  if (letter) cls.push("filled");
  if (revealed) cls.push("revealed");
  cls.push(`s-${status}`);
  return (
    <div
      className={cls.join(" ")}
      style={{ transitionDelay: `${revealDelay}ms`, animationDelay: `${revealDelay}ms` }}
    >
      {letter.toUpperCase()}
    </div>
  );
}
