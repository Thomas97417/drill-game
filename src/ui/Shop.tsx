import { useEffect } from 'react';
import {
  DRILL_TIERS,
  DYNAMITE_PRICE,
  FUEL_PRICE,
  HULL_TIERS,
  JETPACK_TIERS,
  ORE_IDS,
  REPAIR_PRICE,
  TANK_TIERS,
  TELEPORTER_PRICE,
  TILES,
  cargoValue,
  fmt,
} from '../game/constants';
import { isBuilding, maxFuelOf, maxHullOf, useGameStore, type UpgradeKind } from '../store';

const UPGRADE_ROWS: { kind: UpgradeKind; title: string; tiers: typeof DRILL_TIERS; statLabel: (s: number) => string }[] = [
  { kind: 'drill', title: '⚙️ Foreuse (vitesse)', tiers: DRILL_TIERS, statLabel: (s) => `×${s}` },
  { kind: 'tank', title: '⛽ Réservoir', tiers: TANK_TIERS, statLabel: (s) => `${s} L` },
  { kind: 'hull', title: '🛡 Coque', tiers: HULL_TIERS, statLabel: (s) => `${s} PV` },
  { kind: 'jetpack', title: '🚀 Jetpack (vitesse de vol)', tiers: JETPACK_TIERS, statLabel: (s) => `×${s}` },
];

const TITLES = {
  sell: '🏪 Vente de minerais',
  fuel: '⛽ Station essence',
  garage: '🔧 Atelier',
} as const;

export function Shop() {
  const ui = useGameStore((s) => s.ui);
  const money = useGameStore((s) => s.money);
  const cargo = useGameStore((s) => s.cargo);
  const fuel = useGameStore((s) => s.fuel);
  const hull = useGameStore((s) => s.hull);
  const upgrades = useGameStore((s) => s.upgrades);
  const teleporters = useGameStore((s) => s.teleporters);
  const dynamites = useGameStore((s) => s.dynamites);
  const sellAll = useGameStore((s) => s.sellAll);
  const buyFuel = useGameStore((s) => s.buyFuel);
  const repairHull = useGameStore((s) => s.repairHull);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const buyTeleporter = useGameStore((s) => s.buyTeleporter);
  const buyDynamite = useGameStore((s) => s.buyDynamite);
  const closeShop = useGameStore((s) => s.closeShop);

  const open = isBuilding(ui);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyE') closeShop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeShop]);

  if (!open) return null;

  const maxFuel = maxFuelOf(upgrades);
  const maxHull = maxHullOf(upgrades);
  const missingFuel = maxFuel - fuel;
  const missingHull = maxHull - hull;
  const total = cargoValue(cargo);
  const cargoEntries = ORE_IDS.filter((id) => (cargo[id] ?? 0) > 0);

  return (
    <div className="overlay">
      <div className="modal shop">
        <div className="modal-header">
          <h2>{TITLES[ui]}</h2>
          <div className="money">{fmt(money)} $</div>
          <button className="btn btn-small" onClick={closeShop}>
            ✕ Fermer [Échap]
          </button>
        </div>

        {ui === 'sell' && (
          <div className="tab-content">
            {cargoEntries.length === 0 ? (
              <p className="dim">Votre soute est vide. Allez creuser !</p>
            ) : (
              <>
                <table className="sell-table">
                  <tbody>
                    {cargoEntries.map((id) => (
                      <tr key={id}>
                        <td>
                          <span className="cargo-dot" style={{ background: TILES[id].gem }} />
                          {TILES[id].name}
                        </td>
                        <td>×{cargo[id]}</td>
                        <td>{fmt(TILES[id].value ?? 0)} $ / u.</td>
                        <td className="right">{fmt((cargo[id] ?? 0) * (TILES[id].value ?? 0))} $</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="btn btn-primary" onClick={sellAll}>
                  Tout vendre — {fmt(total)} $
                </button>
              </>
            )}
          </div>
        )}

        {ui === 'fuel' && (
          <div className="tab-content">
            <p>
              Réservoir : <b>{fmt(fuel)} / {fmt(maxFuel)} L</b> · Essence à {FUEL_PRICE} $/L
            </p>
            <div className="btn-row">
              {[10, 25, 50].map((l) => (
                <button
                  key={l}
                  className="btn"
                  disabled={missingFuel <= 0 || money < 1}
                  onClick={() => buyFuel(l)}
                >
                  +{l} L ({fmt(Math.min(l, missingFuel) * FUEL_PRICE)} $)
                </button>
              ))}
              <button
                className="btn btn-primary"
                disabled={missingFuel <= 0 || money < 1}
                onClick={() => buyFuel(Infinity)}
              >
                Plein ({fmt(missingFuel * FUEL_PRICE)} $)
              </button>
            </div>
          </div>
        )}

        {ui === 'garage' && (
          <div className="tab-content">
            <div className="upgrade-row">
              <div>
                <b>🔧 Réparation de la coque</b>
                <div className="dim">
                  {fmt(hull)} / {fmt(maxHull)} PV · {REPAIR_PRICE} $/PV
                </div>
              </div>
              <button
                className="btn"
                disabled={missingHull <= 0 || money < 1}
                onClick={repairHull}
              >
                Réparer ({fmt(missingHull * REPAIR_PRICE)} $)
              </button>
            </div>
            {UPGRADE_ROWS.map(({ kind, title, tiers, statLabel }) => {
              const lvl = upgrades[kind];
              const cur = tiers[lvl];
              const next = tiers[lvl + 1];
              return (
                <div key={kind} className="upgrade-row">
                  <div>
                    <b>{title}</b>
                    <div className="dim">
                      Actuel : {cur.name} ({statLabel(cur.stat)})
                    </div>
                  </div>
                  {next ? (
                    <button
                      className="btn"
                      disabled={money < next.price}
                      onClick={() => buyUpgrade(kind)}
                    >
                      {next.name} ({statLabel(next.stat)}) — {fmt(next.price)} $
                    </button>
                  ) : (
                    <span className="dim">Niveau max</span>
                  )}
                </div>
              );
            })}
            <div className="upgrade-row">
              <div>
                <b>🧨 Dynamite</b>
                <div className="dim">
                  Détruit les blocs alentour — seul moyen de casser les rochers. Mèche de 3 s,
                  éloignez-vous ! · en stock : ×{dynamites}
                </div>
              </div>
              <button
                className="btn"
                disabled={money < DYNAMITE_PRICE}
                onClick={buyDynamite}
              >
                Acheter — {fmt(DYNAMITE_PRICE)} $
              </button>
            </div>
            <div className="upgrade-row">
              <div>
                <b>🌀 Téléporteur d'urgence</b>
                <div className="dim">Retour instantané à la surface · usage unique · en stock : ×{teleporters}</div>
              </div>
              <button
                className="btn"
                disabled={money < TELEPORTER_PRICE}
                onClick={buyTeleporter}
              >
                Acheter — {fmt(TELEPORTER_PRICE)} $
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
