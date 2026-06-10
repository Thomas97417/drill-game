import { useEffect, useRef } from 'react';
import type { TileKind } from '../game/constants';
import { drawTileIcon } from '../game/tileart';

// Icône de minerai pour l'UI : reprend le sprite exact des tuiles du monde
export function OreIcon({ kind, size = 26 }: { kind: TileKind; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTileIcon(ctx, kind, size * 2); // rendu en 2× pour rester net en HiDPI
  }, [kind, size]);

  return (
    <canvas
      ref={ref}
      width={size * 2}
      height={size * 2}
      className="ore-icon"
      style={{ width: size, height: size }}
    />
  );
}
