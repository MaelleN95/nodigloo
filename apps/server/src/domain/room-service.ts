import { MAX_PLAYERS } from '@nodigloo/shared';
import { randomBytes, randomUUID } from 'node:crypto';
import { DomainError } from './errors.js';
import {
  isValidNickname,
  nicknameKey,
  normalizeNickname,
} from './nickname.js';
import {
  generateRoomCode,
  generateUniqueRoomCode,
  normalizeRoomCode,
} from './room-code.js';
import type { Player, Room } from './room.js';

// Tout ce qui est aléatoire ou dépend de l'heure passe par ici,
// pour pouvoir le remplacer par des valeurs fixes dans les tests.
export interface RoomServiceDeps {
  now: () => number;
  generatePlayerId: () => string;
  generateReconnectToken: () => string;
  generateCode: () => string;
}

const defaultDeps: RoomServiceDeps = {
  now: () => Date.now(),
  generatePlayerId: () => randomUUID(),
  generateReconnectToken: () => randomBytes(32).toString('hex'),
  generateCode: generateRoomCode,
};

export interface RoomMembership {
  room: Room;
  player: Player;
}

export class RoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly deps: RoomServiceDeps;

  constructor(deps: Partial<RoomServiceDeps> = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  createRoom(nickname: string, socketId: string): RoomMembership {
    if (!isValidNickname(nickname)) {
      throw new DomainError('INVALID_PAYLOAD', 'Pseudonyme invalide');
    }

    const now = this.deps.now();
    const code = generateUniqueRoomCode(
      (candidate) => this.rooms.has(candidate),
      this.deps.generateCode,
    );
    const host = this.createPlayer(nickname, socketId, now);

    const room: Room = {
      code,
      status: 'lobby',
      hostId: host.id,
      players: new Map([[host.id, host]]),
      createdAt: now,
      abandonedAt: null,
    };
    this.rooms.set(code, room);

    return { room, player: host };
  }

  joinRoom(code: string, nickname: string, socketId: string): RoomMembership {
    if (!isValidNickname(nickname)) {
      throw new DomainError('INVALID_PAYLOAD', 'Pseudonyme invalide');
    }

    const room = this.rooms.get(normalizeRoomCode(code));
    if (!room) {
      throw new DomainError('ROOM_NOT_FOUND', 'Salle introuvable');
    }

    if (room.status !== 'lobby') {
      throw new DomainError('GAME_ALREADY_STARTED', 'La partie a déjà commencé');
    }

    if (room.players.size >= MAX_PLAYERS) {
      throw new DomainError('ROOM_FULL', 'La salle est pleine');
    }

    const key = nicknameKey(nickname);
    const taken = [...room.players.values()].some(
      (player) => nicknameKey(player.nickname) === key,
    );
    if (taken) {
      throw new DomainError('NICKNAME_TAKEN', 'Ce pseudonyme est déjà pris');
    }

    const player = this.createPlayer(nickname, socketId, this.deps.now());
    room.players.set(player.id, player);
    room.abandonedAt = null;

    return { room, player };
  }

  // On passe le socketId de la connexion qui vient de se fermer : si le joueur s'est déjà
  // reconnecté avec un autre socket, l'ancien socket qui se ferme en retard ne doit rien casser.
  markDisconnected(code: string, playerId: string, socketId: string): void {
    const room = this.rooms.get(code);
    const player = room?.players.get(playerId);

    if (!room || !player || player.socketId !== socketId) {
      return;
    }

    const now = this.deps.now();
    player.socketId = null;
    player.disconnectedAt = now;

    const someoneConnected = [...room.players.values()].some(
      (p) => p.socketId !== null,
    );
    if (!someoneConnected) {
      room.abandonedAt = now;
    }
  }

  private createPlayer(
    nickname: string,
    socketId: string,
    joinedAt: number,
  ): Player {
    return {
      id: this.deps.generatePlayerId(),
      nickname: normalizeNickname(nickname),
      reconnectToken: this.deps.generateReconnectToken(),
      socketId,
      score: 0,
      joinedAt,
      disconnectedAt: null,
    };
  }
}
