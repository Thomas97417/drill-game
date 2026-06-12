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
  cargoLoad,
  cargoValue,
  fmt,
} from "../game/constants";
import { maxCargoOf, useGameStore, type UpgradeKind } from "../store";
import { OreIcon } from "./OreIcon";
import { UpgradeIcon } from "./UpgradeIcon";
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
      kind: "drill" as UpgradeKind,
      label: "Foreuse",
      tier: DRILL_TIERS[upgrades.drill],
      stat: `×${DRILL_TIERS[upgrades.drill].stat}`,
    },
    {
      kind: "tank" as UpgradeKind,
      label: "Réservoir",
      tier: TANK_TIERS[upgrades.tank],
      stat: `${TANK_TIERS[upgrades.tank].stat} L`,
    },
    {
      kind: "hull" as UpgradeKind,
      label: "Coque",
      tier: HULL_TIERS[upgrades.hull],
      stat: `${HULL_TIERS[upgrades.hull].stat} PV`,
    },
    {
      kind: "jetpack" as UpgradeKind,
      label: "Moteur",
      tier: JETPACK_TIERS[upgrades.jetpack],
      stat: `×${JETPACK_TIERS[upgrades.jetpack].stat}`,
    },
    {
      kind: "cargo" as UpgradeKind,
      label: "Soute",
      tier: CARGO_TIERS[upgrades.cargo],
      stat: `${CARGO_TIERS[upgrades.cargo].stat} stockage`,
    },
    {
      kind: "radiator" as UpgradeKind,
      label: "Radiateur",
      tier: RADIATOR_TIERS[upgrades.radiator],
      stat: `−${Math.round(RADIATOR_TIERS[upgrades.radiator].stat * 100)} %`,
    },
  ];

  return (
    <div className="overlay">
      <div className="modal inventory">
        <div className="modal-header">
          <h2>Inventaire</h2>
          <div className="money">{fmt(money)} $</div>
          <button className="btn btn-small" onClick={toggleInventory}>
            ✕ Fermer
          </button>
        </div>

        <h3 className="shop-section">
          Soute ({cargoLoad(cargo)}/{maxCargoOf(upgrades)})
        </h3>
        {cargoEntries.length === 0 ? (
          <p className="empty-state">
            ⛏ Soute vide — la valeur de vos trouvailles s'affichera ici.
          </p>
        ) : (
          <table className="sell-table">
            <tbody>
              {cargoEntries.map((id) => (
                <tr key={id}>
                  <td className="ore-cell">
                    <OreIcon kind={id} size={24} />
                    {TILES[id].name}
                    <span className="dim ore-size">▣{TILES[id].size}</span>
                  </td>
                  <td className="dim">×{cargo[id]}</td>
                  <td className="right gold">
                    {fmt((cargo[id] ?? 0) * (TILES[id].value ?? 0))} $
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}>
                  <b>Valeur totale</b>
                </td>
                <td className="right gold">{fmt(cargoValue(cargo))} $</td>
              </tr>
            </tbody>
          </table>
        )}

        <h3 className="shop-section">Équipement consommable</h3>
        <p>
          <span className="chip">
            Téléporteurs <b>×{teleporters}</b>
          </span>
          <span className="chip">
            Dynamites <b>×{dynamites}</b>
          </span>
        </p>

        <h3 className="shop-section">Améliorations installées</h3>
        <table className="sell-table">
          <tbody>
            {gear.map((g) => (
              <tr key={g.label}>
                <td className="ore-cell">
                  <UpgradeIcon kind={g.kind} tier={upgrades[g.kind]} size={34} />
                  {g.label}
                </td>
                <td>{g.tier.name}</td>
                <td className="right dim">
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
