import { fmt } from "../game/constants";
import { getPlanet } from "../game/planets";
import { useGameStore } from "../store";
import { useArrowNav } from "./useArrowNav";

export function Victory() {
  const ui = useGameStore((s) => s.ui);
  const planet = useGameStore((s) => s.planet);
  const money = useGameStore((s) => s.money);
  const day = useGameStore((s) => s.day);
  const maxDepth = useGameStore((s) => s.maxDepth);
  const continueMining = useGameStore((s) => s.continueMining);
  const boardForNextPlanet = useGameStore((s) => s.boardForNextPlanet);
  const newGame = useGameStore((s) => s.newGame);

  useArrowNav(ui === "victory");

  if (ui !== "victory") return null;

  const cfg = getPlanet(planet);
  const next = cfg.next ? getPlanet(cfg.next) : null;

  return (
    <div className="overlay">
      <div className="modal victory">
        <h2>{cfg.victory.title}</h2>
        {cfg.victory.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <table className="sell-table victory-stats">
          <tbody>
            <tr>
              <td>Fortune amassée</td>
              <td className="right gold">{fmt(money)} $</td>
            </tr>
            <tr>
              <td>Jours sur {cfg.name}</td>
              <td className="right">{day}</td>
            </tr>
            <tr>
              <td>Profondeur record</td>
              <td className="right">{fmt(maxDepth)} m</td>
            </tr>
          </tbody>
        </table>
        <div className="btn-row">
          {next && (
            <button className="btn btn-primary" onClick={boardForNextPlanet}>
              {cfg.victory.boardLabel ?? `🚀 Embarquer pour ${next.name}`}
            </button>
          )}
          <button className="btn" onClick={continueMining}>
            ⛏ Continuer l'exploitation
          </button>
          <button
            className="btn"
            onClick={() => {
              if (
                window.confirm(
                  "Recommencer une nouvelle partie ? La progression sera effacée.",
                )
              ) {
                newGame();
              }
            }}
          >
            ↺ Nouvelle partie
          </button>
        </div>
      </div>
    </div>
  );
}
