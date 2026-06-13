import { useEffect } from 'react';

// Navigation clavier dans les menus : les flèches déplacent le focus entre
// les boutons du panneau ouvert, Entrée valide — le jeu se joue d'une seule
// main au clavier, sans souris.
export function useArrowNav(open: boolean) {
  useEffect(() => {
    if (!open) return;

    // focus initial sur le premier bouton du contenu (à défaut, du panneau)
    const t = setTimeout(() => {
      const target =
        document.querySelector<HTMLButtonElement>('.modal .tab-content button:not(:disabled)') ??
        document.querySelector<HTMLButtonElement>('.modal button:not(:disabled)');
      target?.focus();
    }, 0);

    // mêmes touches que le pilotage de la foreuse : flèches + ZQSD/WASD
    // (codes physiques, donc valables sur les deux dispositions)
    const NEXT = ['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'];
    const PREV = ['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'];

    const onKey = (e: KeyboardEvent) => {
      // Espace valide aussi le bouton focalisé (Entrée est native, mais le jeu
      // bloque le comportement par défaut d'Espace pour la touche de vol)
      if (e.code === 'Space') {
        const a = document.activeElement as HTMLButtonElement | null;
        if (a?.tagName === 'BUTTON' && a.closest('.modal')) {
          e.preventDefault();
          // les boutons « maintenir pour valider » gèrent eux-mêmes Espace
          if (!a.dataset.hold) a.click();
        }
        return;
      }
      const dir = NEXT.includes(e.code) ? 1 : PREV.includes(e.code) ? -1 : 0;
      if (dir === 0) return;
      const modal = document.querySelector('.modal');
      if (!modal) return;
      e.preventDefault();
      const btns = Array.from(modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      if (btns.length === 0) return;
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      btns[(i + dir + btns.length) % btns.length].focus();
    };

    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
}
