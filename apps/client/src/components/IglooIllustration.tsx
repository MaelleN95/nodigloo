import { useEffect, useRef, useState } from 'react';
import type { createIglooScene } from '../lib/iglooScene';

export function IglooIllustration() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const sceneRef = useRef<ReturnType<typeof createIglooScene>>();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let cancelled = false;

    void import('../lib/iglooScene')
      .then(({ createIglooScene }) => {
        if (cancelled) {
          return;
        }
        sceneRef.current = createIglooScene(
          container,
          () => setReady(false),
          (enabled, isAutomatic) => {
            setAnimationEnabled(enabled);
            setAutomatic(isAutomatic);
          },
        );
        setReady(true);
      })
      .catch((error: unknown) => {
        console.error('Impossible de charger l’illustration 3D', error);
      });

    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = undefined;
    };
  }, []);

  return (
    <div className="igloo-illustration">
      <div className="igloo-visual" aria-hidden="true">
        {!ready && <img className="igloo-fallback" src="/logo.png" alt="" />}
        <div
          ref={containerRef}
          className={`igloo-scene${ready ? ' is-ready' : ''}`}
        />
      </div>
      <div className="igloo-controls">
        {ready && (
          <button
            type="button"
            className="igloo-animation-button"
            onClick={() => sceneRef.current?.setAnimationEnabled(!animationEnabled)}
          >
            {automatic
              ? (animationEnabled ? 'Arrêter l’animation' : 'Relancer l’animation')
              : (animationEnabled ? 'Désactiver le suivi de la souris' : 'Activer le suivi de la souris')}
          </button>
        )}
      </div>
    </div>
  );
}
