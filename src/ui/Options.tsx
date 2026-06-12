import { useEffect } from 'react';
import { useGameStore, type KeyboardLayout } from '../store';

function controls(layout: KeyboardLayout): [string, string][] {
  const move = layout === 'azerty' ? 'ZQSD' : 'WASD';
  return [
    [`${move} / flèches`, 'Se déplacer et creuser (gauche, droite, bas)'],
    [layout === 'azerty' ? 'Z / ↑' : 'W / ↑', 'Voler (réacteur dorsal)'],
    ['E', 'Entrer dans un bâtiment / fermer un menu'],
    ['F', 'Action rapide du bâtiment (vendre, plein, réparer)'],
    ['I', 'Inventaire'],
    ['T', "Téléporteur d'urgence"],
    ['X', 'Larguer une dynamite'],
  ];
}

export function Options() {
  const ui = useGameStore((s) => s.ui);
  const layout = useGameStore((s) => s.layout);
  const setLayout = useGameStore((s) => s.setLayout);
  const toggleOptions = useGameStore((s) => s.toggleOptions);
  const newGame = useGameStore((s) => s.newGame);

  const open = ui === 'options';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') toggleOptions();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, toggleOptions]);

  if (!open) return null;

  return (
    <div className="overlay">
      <div className="modal options">
        <div className="modal-header">
          <h2>⚙ Options</h2>
          <button className="btn btn-small" onClick={toggleOptions}>
            ✕ Fermer [Échap]
          </button>
        </div>

        <h3 className="inv-section">Clavier</h3>
        <div className="layout-btns">
          <button
            className={`btn ${layout === 'azerty' ? 'btn-primary' : ''}`}
            onClick={() => setLayout('azerty')}
          >
            AZERTY
          </button>
          <button
            className={`btn ${layout === 'qwerty' ? 'btn-primary' : ''}`}
            onClick={() => setLayout('qwerty')}
          >
            QWERTY
          </button>
        </div>

        <h3 className="inv-section">Contrôles</h3>
        <table className="sell-table">
          <tbody>
            {controls(layout).map(([key, label]) => (
              <tr key={key}>
                <td className="key-cell">{key}</td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="inv-section">Partie</h3>
        <p className="dim">
          La partie est sauvegardée automatiquement dans le navigateur.
        </p>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm('Recommencer une nouvelle partie ? La progression sera effacée.')) {
              newGame();
            }
          }}
        >
          ↺ Nouvelle partie
        </button>
      </div>
    </div>
  );
}
