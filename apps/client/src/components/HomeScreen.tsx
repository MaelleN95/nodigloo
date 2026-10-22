import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRoom } from '../context/RoomContext';
import { getServerError } from '../lib/socketHelpers';
import { IglooIllustration } from './IglooIllustration';

export function HomeScreen() {
  const { resuming, setError, getSocket, enterRoom } = useRoom();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const [slowConnection, setSlowConnection] = useState(false);
  const connectionAbort = useRef<AbortController | null>(null);
  const busy = pending !== null || resuming;

  useEffect(() => () => connectionAbort.current?.abort(), []);

  useEffect(() => {
    if (pending === null) {
      setSlowConnection(false);
      return;
    }
    const timer = window.setTimeout(() => setSlowConnection(true), 3_000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  const connectToRoomServer = async () => {
    const controller = new AbortController();
    connectionAbort.current = controller;
    return getSocket({ timeoutMs: 120_000, signal: controller.signal });
  };

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    setError(null);
    setPending('create');

    try {
      const socket = await connectToRoomServer();
      const result = await socket.timeout(8_000).emitWithAck('room:create', {
        nickname: nickname.trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      enterRoom(result.data);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
        setError(getServerError(caught));
      }
    } finally {
      setPending(null);
    }
  };

  const joinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    setError(null);
    setPending('join');

    try {
      const socket = await connectToRoomServer();
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
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
        setError(getServerError(caught));
      }
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
            Retrouve tes amis dans un refuge bien au chaud et amusez-vous !
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
            <p className="eyebrow">PREMIÈRE ÉTAPE</p>
            <h2 id="entry-title">On se retrouve où ?</h2>
          </div>
          <span className="step-number" aria-hidden="true">
            01
          </span>
        </div>

        {pending !== null && slowConnection && (
          <p className="notice notice-info" role="status">
            Le serveur peut être en veille. La connexion peut prendre une à deux minutes.
            {' '}Ta demande est conservée, inutile de recliquer.
          </p>
        )}

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
              placeholder="Ex. Maëlle"
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
              placeholder="Ex. Maëlle"
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
