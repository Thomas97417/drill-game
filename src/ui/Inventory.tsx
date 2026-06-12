import { useEffect } from "react";
import {
  CARGO_TIERS,
  DRILL_TIERS,
  HULL_TIERS,
  JETPACK_TIERS,
  ORE_IDS,
  RADIATOR_TIERS,
  TANK_TIERS,
  TILES,
  cargoCount,
  cargoValue,
  fmt,
} from "../game/constants";
import { maxCargoOf, useGameStore } from "../store";
import { OreIcon } from "./OreIcon";
import { useArrowNav } from "./useArrowNav";

export function Inventory() {
  const ui = useGameStore((s) => s.ui);
  const money = useGameStore((s) => s.money);
  const cargo = useGameStore((s) => s.cargo);
  const upgrades = useGameStore((s) => s.upgrades);
  const teleporters = useGameStore((s) => s.teleporters);
  const dynamites = useGameStore((s) => s.dynamites);
  const maxDepth = useGameStore((s) => s.maxDepth);
  const toggleInventory = useGameStore((s) => s.toggleInventory);

  const open = ui === "inventory";
  useArrowNav(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "KeyE" || e.code === "KeyI")
        toggleInventory();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggleInventory]);

  if (!open) return null;

  const cargoEntries = ORE_IDS.filter((id) => (cargo[id] ?? 0) > 0);
  const gear = [
    {
      label: "⚙️ Foreuse",
      tier: DRILL_TIERS[upgrades.drill],
      stat: `×${DRILL_TIERS[upgrades.drill].stat}`,
    },
    {
      label: "⛽ Réservoir",
      tier: TANK_TIERS[upgrades.tank],
      stat: `${TANK_TIERS[upgrades.tank].stat} L`,
    },
    {
      label: "🛡 Coque",
      tier: HULL_TIERS[upgrades.hull],
      stat: `${HULL_TIERS[upgrades.hull].stat} PV`,
    },
    {
      label: "🚀 Moteur",
      tier: JETPACK_TIERS[upgrades.jetpack],
      stat: `×${JETPACK_TIERS[upgrades.jetpack].stat}`,
    },
    {
      label: "📦 Soute",
      tier: CARGO_TIERS[upgrades.cargo],
      stat: `${CARGO_TIERS[upgrades.cargo].stat} minerais`,
    },
    {
      label: "❄️ Radiateur",
      tier: RADIATOR_TIERS[upgrades.radiator],
      stat: `−${Math.round(RADIATOR_TIERS[upgrades.radiator].stat * 100)} %`,
    },
  ];

  return (
    <div className="overlay">
      <div className="modal inventory">
        <div className="modal-header">
          <h2>🎒 Inventaire</h2>
          <div className="money">{fmt(money)} $</div>
          <button className="btn btn-small" onClick={toggleInventory}>
            ✕ Fermer
          </button>
        </div>

        <h3 className="inv-section">
          Soute ({cargoCount(cargo)}/{maxCargoOf(upgrades)})
        </h3>
        {cargoEntries.length === 0 ? (
          <p className="dim">
            Soute vide — la valeur de vos trouvailles s'affichera ici.
          </p>
        ) : (
          <table className="sell-table">
            <tbody>
              {cargoEntries.map((id) => (
                <tr key={id}>
                  <td className="ore-cell">
                    <OreIcon kind={id} size={24} />
                    {TILES[id].name}
                  </td>
                  <td>×{cargo[id]}</td>
                  <td className="right">
                    {fmt((cargo[id] ?? 0) * (TILES[id].value ?? 0))} $
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}>
                  <b>Valeur totale</b>
                </td>
                <td className="right">{fmt(cargoValue(cargo))} $</td>
              </tr>
            </tbody>
          </table>
        )}

        <h3 className="inv-section">Équipement consommable</h3>
        <p>
          🌀 Téléporteurs : <b>×{teleporters}</b> · 🧨 Dynamites :{" "}
          <b>×{dynamites}</b>
        </p>

        <h3 className="inv-section">Améliorations installées</h3>
        <table className="sell-table">
          <tbody>
            {gear.map((g) => (
              <tr key={g.label}>
                <td>{g.label}</td>
                <td>{g.tier.name}</td>
                <td className="right">
                  {g.stat !== g.tier.name ? g.stat : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="dim">Profondeur record : {fmt(maxDepth)} m</p>
        <div className="menu-hint dim">
          ↑↓ / ZQSD naviguer · Entrée ou Espace valider · Échap ou E fermer
        </div>
      </div>
    </div>
  );
}
