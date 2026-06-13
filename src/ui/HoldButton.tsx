import { useEffect, useRef, useState } from "react";

// Bouton « maintenir pour valider » : la barre se remplit de gauche à droite
// tant qu'on garde le clic (ou Entrée/Espace au clavier, ou la touche externe
// via `active`). Arrivée à 100 %, l'action se déclenche une fois ; si on relâche
// avant, la barre se vide progressivement. Le remplissage est un pseudo-élément
// piloté par la variable CSS --hold, donc la mise en page du bouton est intacte.
interface HoldButtonProps {
  onConfirm: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
  active?: boolean; // maintien piloté de l'extérieur (ex. touche F du shop)
  fillMs?: number; // durée de remplissage (maintien)
  drainMs?: number; // durée de vidage (relâché)
}

export function HoldButton({
  onConfirm,
  children,
  className = "",
  disabled = false,
  title,
  active = false,
  fillMs = 700,
  drainMs = 450,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  const heldRef = useRef(false); // maintien souris/clavier sur ce bouton
  const extRef = useRef(false); // maintien externe (touche F)
  const progRef = useRef(0);
  const firedRef = useRef(false);
  const confirmRef = useRef(onConfirm);
  const fillRef = useRef(fillMs);
  const drainRef = useRef(drainMs);
  const startRef = useRef<() => void>(() => {});

  // valeurs « live » sans recréer la boucle d'animation
  useEffect(() => {
    confirmRef.current = onConfirm;
    fillRef.current = fillMs;
    drainRef.current = drainMs;
  });

  // boucle rAF unique : lit les refs pour l'état courant et s'auto-arrête
  useEffect(() => {
    let raf = 0;
    let last = 0;
    function tick(now: number) {
      const dt = last ? now - last : 16;
      last = now;
      const filling = heldRef.current || extRef.current;
      let p =
        progRef.current + (filling ? dt / fillRef.current : -dt / drainRef.current);
      if (p >= 1) {
        p = 1;
        if (!firedRef.current) {
          firedRef.current = true;
          setConfirmed(true);
          confirmRef.current();
        }
      } else if (p <= 0) {
        p = 0;
        setConfirmed(false);
      }
      progRef.current = p;
      setProgress(p);
      if (filling || p > 0) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
        last = 0;
      }
    }
    startRef.current = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    return () => cancelAnimationFrame(raf);
  }, []);

  // maintien externe (touche F) et désactivation en cours de route
  useEffect(() => {
    extRef.current = active && !disabled;
    if (disabled) heldRef.current = false;
    if (!heldRef.current && !extRef.current) firedRef.current = false;
    startRef.current();
  }, [active, disabled]);

  const begin = () => {
    if (disabled) return;
    heldRef.current = true;
    startRef.current();
  };
  const end = () => {
    heldRef.current = false;
    if (!extRef.current) firedRef.current = false; // réarme pour un nouveau tir
    startRef.current();
  };

  const isConfirmKey = (e: React.KeyboardEvent) =>
    e.key === "Enter" || e.key === " " || e.code === "Space";

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      data-hold
      className={`btn hold-btn ${confirmed ? "hold-confirm " : ""}${className}`}
      style={{ "--hold": progress } as React.CSSProperties}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        begin();
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (!isConfirmKey(e)) return;
        e.preventDefault(); // empêche le clic natif (Entrée/Espace) instantané
        if (!e.repeat) begin();
      }}
      onKeyUp={(e) => {
        if (!isConfirmKey(e)) return;
        e.preventDefault();
        end();
      }}
      onBlur={end}
    >
      {children}
    </button>
  );
}
