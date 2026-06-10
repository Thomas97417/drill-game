import { useEffect, useRef } from 'react';
import { Engine } from '../game/engine';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new Engine(canvas);
    if (import.meta.env.DEV) {
      (window as unknown as { __engine: Engine }).__engine = engine;
    }

    const resize = () =>
      engine.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    resize();
    window.addEventListener('resize', resize);
    engine.start();

    return () => {
      window.removeEventListener('resize', resize);
      engine.stop();
    };
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" />;
}
