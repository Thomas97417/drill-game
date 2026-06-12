import {
  FUEL_PRICE,
  ORE_IDS,
  REPAIR_PRICE,
  TILES,
  cargoCount,
  cargoValue,
  fmt,
} from '../game/constants';
import { maxCargoOf, maxFuelOf, maxHullOf, useGameStore } from '../store';
import { OreIcon } from './OreIcon';

function Bar({
  label,
  value,
  max,
  color,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  unit: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="bar">
      <span className="bar-label">{label}</span>
      <div className="bar-outer">
        <div className="bar-inner" style={{ width: `${pct * 100}%`, background: color }} />
        <span className="bar-text">
          {fmt(value)} / {fmt(max)} {unit}
        </span>
      </div>
    </div>
  );
}

export function HUD() {
  const fuel = useGameStore((s) => s.fuel);
  const hull = useGameStore((s) => s.hull);
  const money = useGameStore((s) => s.money);
  const depth = useGameStore((s) => s.depth);
  const maxDepth = useGameStore((s) => s.maxDepth);
  const day = useGameStore((s) => s.day);
  const cargo = useGameStore((s) => s.cargo);
  const upgrades = useGameStore((s) => s.upgrades);
  const teleporters = useGameStore((s) => s.teleporters);
  const dynamites = useGameStore((s) => s.dynamites);
  const nearBuilding = useGameStore((s) => s.nearBuilding);
  const ui = useGameStore((s) => s.ui);
  const openShop = useGameStore((s) => s.openShop);
  const useTeleporter = useGameStore((s) => s.useTeleporter);
  const dropDynamite = useGameStore((s) => s.dropDynamite);
  const toggleInventory = useGameStore((s) => s.toggleInventory);
  const toggleOptions = useGameStore((s) => s.toggleOptions);
  const layout = useGameStore((s) => s.layout);
  const sellAll = useGameStore((s) => s.sellAll);
  const buyFuel = useGameStore((s) => s.buyFuel);
  const repairHull = useGameStore((s) => s.repairHull);

  const maxFuel = maxFuelOf(upgrades);
  const maxHull = maxHullOf(upgrades);
  const maxCargo = maxCargoOf(upgrades);
  const count = cargoCount(cargo);
  const cargoFull = count >= maxCargo;
  const fuelLow = fuel / maxFuel < 0.25;
  const cargoEntries = ORE_IDS.filter((id) => (cargo[id] ?? 0) > 0);

  return (
    <div className="hud">
      <div className="alerts">
        {fuelLow && ui === 'playing' && (
          <div className="fuel-alert">
            ⚠ CARBURANT CRITIQUE — {fmt(fuel)} L restants
            {depth > 0 ? ', remontez faire le plein !' : ' : passez à la pompe !'}
          </div>
        )}
        {cargoFull && ui === 'playing' && (
          <div className="cargo-alert">
            ⚠ SOUTE PLEINE ({count}/{maxCargo}) — les minerais forés sont perdus !
          </div>
        )}
      </div>
      <div className="hud-top-left panel">
        <Bar
          label="⛽"
          value={fuel}
          max={maxFuel}
          color={fuelLow ? '#e74c3c' : '#f5a623'}
          unit="L"
        />
        <Bar label="🛡" value={hull} max={maxHull} color="#2ecc71" unit="PV" />
      </div>

      <div className="hud-top-right panel">
        <div className="hud-tr-head">
          <span className="dim">☀ Jour {day}</span>
          <button className="gear-btn" onClick={toggleOptions} title="Options">
            ⚙
          </button>
        </div>
        <div className="money-big">{fmt(money)} $</div>
        <div className="depth-big">
          ⛏ {depth} m <span className="depth-max">max {maxDepth} m</span>
        </div>
      </div>

      <div className="hud-bottom-center">
        {nearBuilding && ui === 'playing' && (
          <div className="prompt-row">
            <button className="btn btn-shop" onClick={() => openShop(nearBuilding)}>
              [E]{' '}
              {nearBuilding === 'sell'
                ? 'Vendre les minerais'
                : nearBuilding === 'fuel'
                  ? 'Station essence'
                  : 'Atelier'}
            </button>
            {nearBuilding === 'sell' && (
              <button className="btn btn-quick" disabled={count === 0} onClick={sellAll}>
                [F] Tout vendre — {fmt(cargoValue(cargo))} $
              </button>
            )}
            {nearBuilding === 'fuel' && (
              <button
                className="btn btn-quick"
                disabled={maxFuel - fuel < 0.5 || money < 1}
                onClick={() => buyFuel(Infinity)}
              >
                [F] Faire le plein ({fmt((maxFuel - fuel) * FUEL_PRICE)} $)
              </button>
            )}
            {nearBuilding === 'garage' && (
              <button
                className="btn btn-quick"
                disabled={maxHull - hull < 0.5 || money < 1}
                onClick={repairHull}
              >
                [F] Réparer ({fmt((maxHull - hull) * REPAIR_PRICE)} $)
              </button>
            )}
          </div>
        )}
        <div
          className="panel cargo cargo-clickable"
          onClick={toggleInventory}
          title="Ouvrir l'inventaire [I]"
        >
          <span className={cargoFull ? 'cargo-count-full' : 'dim'}>
            Soute {count}/{maxCargo}
          </span>
          {cargoEntries.map((id) => (
            <span key={id} className="cargo-item">
              <OreIcon kind={id} size={18} />
              {TILES[id].name} ×{cargo[id]}
            </span>
          ))}
          {cargoEntries.length > 0 && (
            <span className="cargo-total">≈ {fmt(cargoValue(cargo))} $</span>
          )}
        </div>
      </div>

      <div className="hud-bottom-right">
        <button
          className="btn"
          disabled={dynamites === 0 || ui !== 'playing'}
          onClick={dropDynamite}
          title="Largue une dynamite sous la foreuse — mèche de 3 s"
        >
          🧨 Dynamite [X] ×{dynamites}
        </button>
        <button
          className="btn"
          disabled={teleporters === 0 || depth === 0 || ui !== 'playing'}
          onClick={useTeleporter}
          title="Retour instantané à la surface"
        >
          🌀 Téléporteur [T] ×{teleporters}
        </button>
      </div>

      <div className="hud-bottom-left dim">
        {layout === 'azerty' ? 'ZQSD' : 'WASD'}/flèches creuser · ↑ voler · E bâtiments · F
        action · I inventaire · T téléporteur · X dynamite
      </div>
    </div>
  );
}
