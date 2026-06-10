import { useEffect, useState } from 'react';
import {
  DRILL_TIERS,
  FUEL_PRICE,
  HULL_TIERS,
  ORE_IDS,
  REPAIR_PRICE,
  TANK_TIERS,
  TELEPORTER_PRICE,
  TILES,
  cargoValue,
  fmt,
} from '../game/constants';
import { maxFuelOf, maxHullOf, useGameStore, type UpgradeKind } from '../store';

const TABS = ['Vendre', 'Essence', 'Améliorations', 'Téléporteur'] as const;
type Tab = (typeof TABS)[number];

const UPGRADE_ROWS: { kind: UpgradeKind; title: string; tiers: typeof DRILL_TIERS; statLabel: (s: number) => string }[] = [
  { kind: 'drill', title: '⚙️ Foreuse (vitesse)', tiers: DRILL_TIERS, statLabel: (s) => `×${s}` },
  { kind: 'tank', title: '⛽ Réservoir', tiers: TANK_TIERS, statLabel: (s) => `${s} L` },
  { kind: 'hull', title: '🛡 Coque', tiers: HULL_TIERS, statLabel: (s) => `${s} PV` },
];

export function Shop() {
  const ui = useGameStore((s) => s.ui);
  const money = useGameStore((s) => s.money);
  const cargo = useGameStore((s) => s.cargo);
  const fuel = useGameStore((s) => s.fuel);
  const hull = useGameStore((s) => s.hull);
  const upgrades = useGameStore((s) => s.upgrades);
  const teleporters = useGameStore((s) => s.teleporters);
  const sellAll = useGameStore((s) => s.sellAll);
  const buyFuel = useGameStore((s) => s.buyFuel);
  const repairHull = useGameStore((s) => s.repairHull);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const buyTeleporter = useGameStore((s) => s.buyTeleporter);
  const closeShop = useGameStore((s) => s.closeShop);

  const [tab, setTab] = useState<Tab>('Vendre');

  useEffect(() => {
    if (ui !== 'shop') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyE') closeShop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui, closeShop]);

  if (ui !== 'shop') return null;

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
          <h2>🏪 Magasin</h2>
          <div className="money">{fmt(money)} $</div>
          <button className="btn btn-small" onClick={closeShop}>
            ✕ Fermer [Échap]
          </button>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Vendre' && (
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

        {tab === 'Essence' && (
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
            <hr />
            <p>
              Coque : <b>{fmt(hull)} / {fmt(maxHull)} PV</b> · Réparation à {REPAIR_PRICE} $/PV
            </p>
            <button
              className="btn"
              disabled={missingHull <= 0 || money < 1}
              onClick={repairHull}
            >
              🔧 Réparer ({fmt(missingHull * REPAIR_PRICE)} $)
            </button>
          </div>
        )}

        {tab === 'Améliorations' && (
          <div className="tab-content">
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
          </div>
        )}

        {tab === 'Téléporteur' && (
          <div className="tab-content">
            <p>
              Téléporteur d'urgence : retour instantané à la surface, où que vous soyez.
              Usage unique.
            </p>
            <p>
              En stock : <b>×{teleporters}</b>
            </p>
            <button
              className="btn btn-primary"
              disabled={money < TELEPORTER_PRICE}
              onClick={buyTeleporter}
            >
              Acheter un téléporteur — {fmt(TELEPORTER_PRICE)} $
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
