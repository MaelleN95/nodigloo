import { Link } from 'react-router-dom';
import type { ConnectionState } from '../types';

type HeaderProps = {
  connectionState: ConnectionState;
};

export function Header({ connectionState }: HeaderProps) {
  return (
    <header className="topbar">
      <Link className="wordmark" to="/" aria-label="Nodigloo, accueil">
        <img className="wordmark-icon" src="/logo.png" alt="" />
      </Link>
      <div className="topbar-meta">
        <span className="phase-tag">LE REFUGE DES JOUEURS</span>
        <span
          className={`connection-pill connection-${connectionState}`}
          role="status"
        >
          <span className="connection-dot" />
          {connectionState === 'connected' ? 'Connecté' : 'Hors ligne'}
        </span>
      </div>
    </header>
  );
}
