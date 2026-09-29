import { useEffect, useRef } from 'react';
import { fx } from '../game/fx';

export default function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    fx.attach(ref.current);
    fx.resize();
    const onR = () => fx.resize();
    window.addEventListener('resize', onR);
    return () => { window.removeEventListener('resize', onR); fx.attach(null); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />;
}
