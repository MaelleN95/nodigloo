import { MAX_PLAYERS } from '@nodigloo/shared';

export function Footer() {
  return (
    <footer className="footer-line">
      <span>UNE PETITE GAME AU CHAUD</span>
      <span>2–{MAX_PLAYERS} JOUEURS</span>
    </footer>
  );
}
