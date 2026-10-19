import { randomBytes, randomUUID } from 'node:crypto';
import { DomainError } from './errors.js';
import { isValidNickname, normalizeNickname } from './nickname.js';
import { generateRoomCode, generateUniqueRoomCode } from './room-code.js';
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
