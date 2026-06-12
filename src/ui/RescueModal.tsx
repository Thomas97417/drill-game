import { useGameStore } from '../store';
import { useArrowNav } from './useArrowNav';

export function RescueModal() {
  const ui = useGameStore((s) => s.ui);
  const reason = useGameStore((s) => s.rescueReason);
  const doRescue = useGameStore((s) => s.doRescue);

  useArrowNav(ui === 'rescue');

  if (ui !== 'rescue') return null;

  return (
    <div className="overlay">
      <div className="modal rescue">
        <h2>{reason === 'fuel' ? '⛽ Panne sèche !' : '💥 Coque détruite !'}</h2>
        <p>
          {reason === 'fuel'
            ? 'Votre réservoir est vide, la foreuse est immobilisée dans les profondeurs.'
            : 'Votre foreuse est trop endommagée pour continuer.'}
        </p>
        <p>
          La station de surface envoie une équipe de secours : la foreuse sera rapatriée,
          mais <b>la cargaison à bord est perdue</b>.
        </p>
        <button className="btn btn-primary" onClick={doRescue}>
          🚁 Rapatrier la foreuse
        </button>
      </div>
    </div>
  );
}
