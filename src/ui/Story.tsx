import { fmt } from "../game/constants";
import { getPlanet } from "../game/planets";
import { useGameStore } from "../store";
import { useArrowNav } from "./useArrowNav";

export function Story() {
  const ui = useGameStore((s) => s.ui);
  const planet = useGameStore((s) => s.planet);
  const beginMission = useGameStore((s) => s.beginMission);

  useArrowNav(ui === "story");

  if (ui !== "story") return null;

  const cfg = getPlanet(planet);
  const goalStr = `${fmt(cfg.missionGoal)} $`;

  return (
    <div className="overlay">
      <div className="modal story">
        <h2>{cfg.story.title}</h2>
        {cfg.story.paragraphs.map((p, i) => {
          const parts = p.split("{goal}");
          return (
            <p key={i}>
              {parts.map((part, j) => (
                <span key={j}>
                  {part}
                  {j < parts.length - 1 && <b className="gold">{goalStr}</b>}
                </span>
              ))}
            </p>
          );
        })}
        <button className="btn btn-primary" onClick={beginMission}>
          {cfg.story.beginLabel}
        </button>
      </div>
    </div>
  );
}
