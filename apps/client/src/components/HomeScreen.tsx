import { useState, type FormEvent } from 'react';
import { useRoom } from '../context/RoomContext';
import { getServerError } from '../lib/socketHelpers';
import { IglooIllustration } from './IglooIllustration';

export function HomeScreen() {
  const { resuming, setError, getSocket, enterRoom } = useRoom();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const busy = pending !== null || resuming;

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending('create');

    try {
      const socket = await getSocket();
      const result = await socket.timeout(8_000).emitWithAck('room:create', {
        nickname: nickname.trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      enterRoom(result.data);
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setPending(null);
    }
  };

  const joinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending('join');

    try {
      const socket = await getSocket();
      const result = await socket.timeout(8_000).emitWithAck('room:join', {
        code: roomCode.trim().toUpperCase(),
        nickname: nickname.trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      enterRoom(result.data);
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setPending(null);
    }
  };

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

      {resuming && (
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
          <form className="entry-card" onSubmit={createRoom}>
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
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Ex. Camille"
            />
            <button
              className="button button-primary"
              type="submit"
              disabled={busy}
            >
              {pending === 'create' ? 'Ouverture…' : 'Créer ma salle'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <form className="entry-card entry-card-join" onSubmit={joinRoom}>
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
              onChange={(event) => setNickname(event.target.value)}
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
                setRoomCode(event.target.value.toUpperCase())
              }
              placeholder="ABCDE"
            />
            <button
              className="button button-secondary"
              type="submit"
              disabled={busy}
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
