import { fmt } from "../game/constants";
import { useGameStore } from "../store";
import { useArrowNav } from "./useArrowNav";

export function Victory() {
  const ui = useGameStore((s) => s.ui);
  const money = useGameStore((s) => s.money);
  const day = useGameStore((s) => s.day);
  const maxDepth = useGameStore((s) => s.maxDepth);
  const continueMining = useGameStore((s) => s.continueMining);
  const newGame = useGameStore((s) => s.newGame);

  useArrowNav(ui === "victory");

  if (ui !== "victory") return null;

  return (
    <div className="overlay">
      <div className="modal victory">
        <h2>🚀 Dette remboursée !</h2>
        <p>
          La fusée s'arrache du sol de XK-712, et pour la première fois depuis
          longtemps, ce n'est pas le compteur de carburant que vous regardez —
          c'est le ciel.
        </p>
        <p>
          La Compagnie Minière Trans-Stellaire « vous félicite pour votre
          professionnalisme » et vous propose déjà un nouveau contrat. Vous
          l'écouterez peut-être. Plus tard.
        </p>
        <table className="sell-table victory-stats">
          <tbody>
            <tr>
              <td>Fortune amassée</td>
              <td className="right gold">{fmt(money)} $</td>
            </tr>
            <tr>
              <td>Jours sur XK-712</td>
              <td className="right">{day}</td>
            </tr>
            <tr>
              <td>Profondeur record</td>
              <td className="right">{fmt(maxDepth)} m</td>
            </tr>
          </tbody>
        </table>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={continueMining}>
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
