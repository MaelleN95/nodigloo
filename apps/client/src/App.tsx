import './style.css';

export function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Nodigloo, accueil">
          <span className="wordmark-icon" aria-hidden="true">
            N
          </span>
          nodigloo
        </a>
        <span className="phase-tag">PHASE A · SOCLE</span>
      </header>

      <section className="status-panel" aria-labelledby="page-title">
        <div className="status-copy">
          <p className="eyebrow">
            <span className="status-dot" /> ENVIRONNEMENT LOCAL
          </p>
          <h1 id="page-title">
            Le terrain de jeu
            <br />
            est en place.
          </h1>
          <p className="description">
            L'interface de test est servie par Nginx. Le serveur temps réel
            attend les prochaines étapes de construction.
          </p>
          <a className="health-link" href="http://localhost:3001/health">
            <span>Vérifier le serveur</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="status-visual" aria-hidden="true">
          <div className="orbit orbit-outer" />
          <div className="orbit orbit-inner" />
          <div className="center-mark">N</div>
          <span className="node node-top" />
          <span className="node node-right" />
          <span className="node node-bottom" />
        </div>
      </section>

      <footer className="footer-line">
        <span>REACT · VITE</span>
        <span>EXPRESS · SOCKET.IO</span>
        <span>DOCKER COMPOSE</span>
      </footer>
    </main>
  );
}
