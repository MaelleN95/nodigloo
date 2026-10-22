import { useEffect, useRef, useState } from 'react';

export function IglooIllustration() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let cancelled = false;
    let dispose: (() => void) | undefined;

    void import('../lib/iglooScene')
      .then(({ createIglooScene }) => {
        if (cancelled) {
          return;
        }
        dispose = createIglooScene(container, () => setReady(false));
        setReady(true);
      })
      .catch((error: unknown) => {
        console.error('Impossible de charger l’illustration 3D', error);
      });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <div className="igloo-illustration" aria-hidden="true">
      {!ready && <img className="igloo-fallback" src="/logo.png" alt="" />}
      <div
        ref={containerRef}
        className={`igloo-scene${ready ? ' is-ready' : ''}`}
      />
    </div>
  );
}
