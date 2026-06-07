interface Props {
  onClose: () => void;
}

// One example row each for correct / present / absent.
const EXAMPLES = [
  { word: "SLATE", at: 0, status: "correct", note: "is in the word and in the right spot." },
  { word: "BRICK", at: 1, status: "present", note: "is in the word but in the wrong spot." },
  { word: "MOUND", at: 4, status: "absent", note: "is not in the word." },
];

export function HowToPlay({ onClose }: Props) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-inner howto" onClick={(e) => e.stopPropagation()}>
        <h2>How to play</h2>
        <p>
          Guess the hidden word in a few tries (6 for a 5-letter word, one more per extra letter).
          Each guess must be a real word of the right length.
        </p>
        <p>After each guess, the tiles change color to show how close you were:</p>

        <ul className="howto-examples">
          {EXAMPLES.map((ex) => (
            <li key={ex.word}>
              <div className="ex-row">
                {ex.word.split("").map((ch, c) => (
                  <div key={c} className={`ex-tile ${c === ex.at ? `s-${ex.status} revealed` : ""}`}>
                    {ch}
                  </div>
                ))}
              </div>
              <span className="ex-note">
                <strong>{ex.word[ex.at]}</strong> {ex.note}
              </span>
            </li>
          ))}
        </ul>

        <p className="muted-text">
          Green = right spot · Yellow = wrong spot · Gray = not in the word.
        </p>
        <p className="muted-text">
          A new puzzle every day (4–7 letters). Race friends in Multiplayer, and sign in to track
          your stats &amp; streaks.
        </p>
        <button className="primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
