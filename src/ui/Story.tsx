import { MISSION_GOAL, fmt } from "../game/constants";
import { useGameStore } from "../store";
import { useArrowNav } from "./useArrowNav";

export function Story() {
  const ui = useGameStore((s) => s.ui);
  const beginMission = useGameStore((s) => s.beginMission);

  useArrowNav(ui === "story");

  if (ui !== "story") return null;

  return (
    <div className="overlay">
      <div className="modal story">
        <h2>🛰 XK-712 — Contrat n° 88-417</h2>
        <p>
          An 2087. La <b>Compagnie Minière Trans-Stellaire</b> vous a vendu un
          rêve : une foreuse d'occasion, un aller simple pour la planète naine
          XK-712, et une promesse — <i>les filons les plus riches du secteur</i>.
        </p>
        <p>
          Le contrat, lui, est moins poétique. La Compagnie réclame{" "}
          <b className="gold">{fmt(MISSION_GOAL)} $</b> pour solder votre
          dette : la foreuse, le voyage, l'oxygène, et les « frais de dossier ».
          Tant que la somme n'est pas réunie,{" "}
          <b>aucune fusée ne viendra vous chercher</b>.
        </p>
        <p>
          Creusez. Vendez. Méfiez-vous de la lave, des chutes et de la panne
          sèche. Et quand votre compte affichera dix millions, rappelez la
          fusée.
        </p>
        <p className="dim">
          La Compagnie vous souhaite une exploitation prospère.
        </p>
        <button className="btn btn-primary" onClick={beginMission}>
          ⛏ Commencer à creuser [Entrée]
        </button>
      </div>
    </div>
  );
}
