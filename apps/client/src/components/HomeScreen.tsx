import type { FormEvent } from 'react';
import type { PendingAction } from '../types';
import { IglooIllustration } from './IglooIllustration';

type HomeScreenProps = {
  nickname: string;
  roomCode: string;
  pending: PendingAction;
  onNicknameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onJoin: (event: FormEvent<HTMLFormElement>) => void;
};

export function HomeScreen({
  nickname,
  roomCode,
  pending,
  onNicknameChange,
  onRoomCodeChange,
  onCreate,
  onJoin,
}: HomeScreenProps) {
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-mark" aria-hidden="true" />
            MINI-JEUX ENTRE AMIS
          </p>
          <h1 id="page-title">
            À l’abri,
            <br />
            <span>on joue.</span>
          </h1>
          <p className="description">
            Retrouve tes amis dans un refuge bien au chaud et découvre qui a la
            meilleure mémoire.
          </p>
        </div>
        <IglooIllustration />
      </section>

      {pending === 'resume' && (
        <p className="notice notice-info" role="status">
          Retrouvons ta salle…
        </p>
      )}

      <section className="entry-panel" aria-labelledby="entry-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PREMIER PAS</p>
            <h2 id="entry-title">On se retrouve où ?</h2>
          </div>
          <span className="step-number" aria-hidden="true">
            01
          </span>
        </div>

        <div className="entry-grid">
          <form className="entry-card" onSubmit={onCreate}>
            <div className="card-icon" aria-hidden="true">
              +
            </div>
            <p className="card-kicker">POUR RECEVOIR</p>
            <h3>Créer une salle</h3>
            <p className="card-description">
              Un code à partager, et tes amis peuvent te rejoindre.
            </p>
            <label htmlFor="create-nickname">Ton pseudo</label>
            <input
              id="create-nickname"
              autoComplete="nickname"
              minLength={2}
              maxLength={20}
              required
              value={nickname}
              onChange={(event) => onNicknameChange(event.target.value)}
              placeholder="Ex. Camille"
            />
            <button
              className="button button-primary"
              type="submit"
              disabled={pending !== null}
            >
              {pending === 'create' ? 'Ouverture…' : 'Créer ma salle'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <form className="entry-card entry-card-join" onSubmit={onJoin}>
            <div className="card-icon card-icon-join" aria-hidden="true">
              ↗
            </div>
            <p className="card-kicker">POUR REJOINDRE</p>
            <h3>J’ai un code</h3>
            <p className="card-description">
              Saisis le code que ton ami t’a envoyé.
            </p>
            <label htmlFor="join-nickname">Ton pseudo</label>
            <input
              id="join-nickname"
              autoComplete="nickname"
              minLength={2}
              maxLength={20}
              required
              value={nickname}
              onChange={(event) => onNicknameChange(event.target.value)}
              placeholder="Ex. Camille"
            />
            <label htmlFor="room-code">Code de la salle</label>
            <input
              id="room-code"
              className="room-code-input"
              autoComplete="off"
              maxLength={5}
              minLength={5}
              required
              value={roomCode}
              onChange={(event) =>
                onRoomCodeChange(event.target.value.toUpperCase())
              }
              placeholder="ABCDE"
            />
            <button
              className="button button-secondary"
              type="submit"
              disabled={pending !== null}
            >
              {pending === 'join' ? 'Connexion…' : 'Rejoindre la salle'}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
