import { useEffect, useState } from "react";
import {
  DYNAMITE_PRICE,
  FUEL_PRICE,
  ORE_IDS,
  REPAIR_PRICE,
  TELEPORTER_PRICE,
  TILES,
  cargoLoad,
  cargoValue,
  fmt,
  type Tier,
} from "../game/constants";
import { getPlanet } from "../game/planets";
import {
  isBuilding,
  maxCargoOf,
  maxFuelOf,
  maxHullOf,
  useGameStore,
  type UpgradeKind,
} from "../store";
import { HoldButton } from "./HoldButton";
import { OreIcon } from "./OreIcon";
import { OreWeight } from "./OreWeight";
import { UpgradeIcon } from "./UpgradeIcon";
import { useArrowNav } from "./useArrowNav";

interface UpgradeRow {
  kind: UpgradeKind;
  title: string;
  tiers: Tier[];
  statLabel: (s: number) => string;
}

// Lignes d'amélioration de l'atelier, construites depuis les paliers de la
// planète active (le slot « thermal » = radiateur ou isolation selon la planète)
function upgradeRows(planet: ReturnType<typeof getPlanet>): UpgradeRow[] {
  const L = planet.ladders;
  return [
    { kind: "drill", title: "Foreuse (vitesse)", tiers: L.drill, statLabel: (s) => `×${s}` },
    { kind: "tank", title: "Réservoir", tiers: L.tank, statLabel: (s) => `${s} L` },
    { kind: "hull", title: "Coque", tiers: L.hull, statLabel: (s) => `${s} PV` },
    { kind: "jetpack", title: "Moteur (vitesse & vol)", tiers: L.jetpack, statLabel: (s) => `×${s}` },
    { kind: "cargo", title: "Soute (stockage)", tiers: L.cargo, statLabel: (s) => `${s} stockage` },
    {
      kind: "thermal",
      title: planet.thermalLabel.title,
      tiers: L.thermal,
      statLabel: planet.thermalLabel.statLabel,
    },
  ];
}

const TITLES = {
  sell: "Hôtel des ventes",
  fuel: "Station essence",
  garage: "Atelier",
} as const;

export function Shop() {
  const ui = useGameStore((s) => s.ui);
  const planet = useGameStore((s) => s.planet);
  const money = useGameStore((s) => s.money);
  const cargo = useGameStore((s) => s.cargo);
  const fuel = useGameStore((s) => s.fuel);
  const hull = useGameStore((s) => s.hull);
  const upgrades = useGameStore((s) => s.upgrades);
  const teleporters = useGameStore((s) => s.teleporters);
  const dynamites = useGameStore((s) => s.dynamites);
  const sellAll = useGameStore((s) => s.sellAll);
  const sellOre = useGameStore((s) => s.sellOre);
  const buyFuel = useGameStore((s) => s.buyFuel);
  const repairHull = useGameStore((s) => s.repairHull);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const buyTeleporter = useGameStore((s) => s.buyTeleporter);
  const buyDynamite = useGameStore((s) => s.buyDynamite);
  const closeShop = useGameStore((s) => s.closeShop);

  const open = isBuilding(ui);
  useArrowNav(open);

  // touche F : maintien de l'action rapide vente/plein (alimente le bouton à
  // remplissage). À l'atelier, la réparation reste une action instantanée.
  const [fHeld, setFHeld] = useState(false);

  const close = () => {
    setFHeld(false);
    closeShop();
  };

  useEffect(() => {
    if (!open) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "KeyE") close();
      if (e.code === "KeyF" && !e.repeat) {
        if (ui === "garage") repairHull();
        else setFHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyF") setFHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ui, closeShop, repairHull]);

  if (!open) return null;

  const maxFuel = maxFuelOf(upgrades);
  const maxHull = maxHullOf(upgrades);
  const missingFuel = maxFuel - fuel;
  const missingHull = maxHull - hull;
  const total = cargoValue(cargo);
  const cargoEntries = ORE_IDS.filter((id) => (cargo[id] ?? 0) > 0);
  const UPGRADE_ROWS = upgradeRows(getPlanet(planet));

  return (
    <div className="overlay">
      <div className="modal shop">
        <div className="modal-header">
          <h2>{TITLES[ui]}</h2>
          <div className="money">{fmt(money)} $</div>
          <button className="btn btn-small" onClick={close}>
            ✕ Fermer
          </button>
        </div>

        {ui === "sell" && (
          <div className="tab-content">
            <h3 className="shop-section">
              Cargaison ({cargoLoad(cargo)}/{maxCargoOf(upgrades)})
            </h3>
            {cargoEntries.length === 0 ? (
              <p className="empty-state">
                ⛏ Votre soute est vide — allez creuser !
              </p>
            ) : (
              <>
                <table className="sell-table">
                  <tbody>
                    {cargoEntries.map((id) => (
                      <tr key={id}>
                        <td className="ore-cell">
                          <OreIcon kind={id} size={30} />
                          {TILES[id].name}
                          <OreWeight size={TILES[id].size} />
                        </td>
                        <td className="dim">×{cargo[id]}</td>
                        <td className="dim">
                          {fmt(TILES[id].value ?? 0)} $ / u.
                        </td>
                        <td className="right gold">
                          {fmt((cargo[id] ?? 0) * (TILES[id].value ?? 0))} $
                        </td>
                        <td className="right">
                          <HoldButton
                            className="btn-small"
                            onConfirm={() => sellOre(id)}
                          >
                            Vendre
                          </HoldButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <HoldButton
                  className="btn-primary buy-btn sell-all"
                  active={fHeld}
                  onConfirm={sellAll}
                >
                  <span>Tout vendre [F]</span>
                  <span className="buy-price">{fmt(total)} $</span>
                </HoldButton>
              </>
            )}
          </div>
        )}

        {ui === "fuel" && (
          <div className="tab-content">
            <h3 className="shop-section">Réservoir</h3>
            <div className="fuel-gauge">
              <div
                className="fuel-gauge-fill"
                style={{ width: `${Math.min(100, (fuel / maxFuel) * 100)}%` }}
              />
              <span className="fuel-gauge-text">
                {fmt(fuel)} / {fmt(maxFuel)} L
              </span>
            </div>
            <p className="dim">
              Essence à {FUEL_PRICE} $/L
              {missingFuel < 0.5 ? " · réservoir plein" : ""}
            </p>
            <div className="fuel-options">
              {[10, 25, 50].map((l) => (
                <HoldButton
                  key={l}
                  className="buy-btn"
                  disabled={missingFuel <= 0 || money < 1}
                  onConfirm={() => buyFuel(l)}
                >
                  <span>+{l} L</span>
                  <span className="buy-price">
                    {fmt(Math.min(l, missingFuel) * FUEL_PRICE)} $
                  </span>
                </HoldButton>
              ))}
              <HoldButton
                className="btn-primary buy-btn"
                disabled={missingFuel <= 0 || money < 1}
                active={fHeld}
                onConfirm={() => buyFuel(Infinity)}
              >
                <span>Plein [F]</span>
                <span className="buy-price">
                  {fmt(missingFuel * FUEL_PRICE)} $
                </span>
              </HoldButton>
            </div>
          </div>
        )}

        {ui === "garage" && (
          <div className="tab-content">
            <h3 className="shop-section">Réparation</h3>
            <div className="upgrade-row" data-kind="repair">
              <div className="row-info">
                <b>Réparation de la coque</b>
                <div className="dim">
                  {fmt(hull)} / {fmt(maxHull)} PV · {REPAIR_PRICE} $/PV
                </div>
              </div>
              <div className="row-icon" />
              <button
                className="btn buy-btn"
                disabled={missingHull <= 0 || money < 1}
                onClick={repairHull}
              >
                <span>Réparer [F]</span>
                <span className="buy-price">
                  {fmt(missingHull * REPAIR_PRICE)} $
                </span>
              </button>
            </div>
            <h3 className="shop-section">Améliorations</h3>
            {UPGRADE_ROWS.map(({ kind, title, tiers, statLabel }) => {
              const lvl = upgrades[kind];
              const cur = tiers[lvl];
              const next = tiers[lvl + 1];
              return (
                <div key={kind} className="upgrade-row" data-kind={kind}>
                  <div className="row-info">
                    <b>{title}</b>
                    <div className="dim">
                      Actuel : {cur.name} ({statLabel(cur.stat)})
                    </div>
                  </div>
                  <div className="row-icon">
                    {next && <UpgradeIcon kind={kind} tier={lvl + 1} planet={planet} />}
                  </div>
                  {next ? (
                    <HoldButton
                      className="buy-btn"
                      disabled={money < next.price}
                      onConfirm={() => buyUpgrade(kind)}
                    >
                      <span>
                        {next.name} ({statLabel(next.stat)})
                      </span>
                      <span className="buy-price">{fmt(next.price)} $</span>
                    </HoldButton>
                  ) : (
                    <span className="tier-max">★ Niveau max</span>
                  )}
                </div>
              );
            })}
            <h3 className="shop-section">Consommables</h3>
            <div className="upgrade-row" data-kind="dynamite">
              <div className="row-info">
                <b>Dynamite</b>
                <div className="dim">(dans la soute : {dynamites})</div>
                <div className="dim">
                  Détruit les blocs alentour. Mèche de 3s. Éloignez-vous !
                </div>
              </div>
              <div className="row-icon" />
              <button
                className="btn buy-btn"
                disabled={money < DYNAMITE_PRICE}
                onClick={buyDynamite}
              >
                <span>Acheter</span>
                <span className="buy-price">{fmt(DYNAMITE_PRICE)} $</span>
              </button>
            </div>
            <div className="upgrade-row" data-kind="teleporter">
              <div className="row-info">
                <b>Téléporteur d'urgence</b>
                <div className="dim">(dans la soute : {teleporters})</div>
                <div className="dim">Retour instantané à la surface</div>
              </div>
              <div className="row-icon" />
              <button
                className="btn buy-btn"
                disabled={money < TELEPORTER_PRICE}
                onClick={buyTeleporter}
              >
                <span>Acheter</span>
                <span className="buy-price">{fmt(TELEPORTER_PRICE)} $</span>
              </button>
            </div>
          </div>
        )}
        <div className="menu-hint dim">
          ↑↓ / ZQSD naviguer · maintenir Entrée/Espace pour valider · Échap ou E
          fermer
        </div>
      </div>
    </div>
  );
}
