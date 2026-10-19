import type { PlayerId, PlayerPublic, RoomPublic, RoomStatus } from '@nodigloo/shared';

// Le joueur côté serveur : il contient des infos qu'on ne doit jamais envoyer aux autres
// (reconnectToken) ou qui ne regardent que le serveur (socketId, joinedAt, disconnectedAt).
export interface Player {
  id: PlayerId;
  nickname: string;
  reconnectToken: string;
  // vide quand le joueur est déconnecté ; change à chaque reconnexion, contrairement à `id`
  socketId: string | null;
  score: number;
  // sert à désigner le joueur connecté le plus ancien quand l'hôte part
  joinedAt: number;
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  status: RoomStatus;
  hostId: PlayerId;
  // Map pour garder l'ordre d'arrivée et retrouver un joueur par son id
  players: Map<PlayerId, Player>;
  createdAt: number;
  // moment où le dernier joueur connecté est parti, sert au nettoyage des salles abandonnées
  abandonedAt: number | null;
}

export const toPlayerPublic = (player: Player): PlayerPublic => ({
  id: player.id,
  nickname: player.nickname,
  connected: player.socketId !== null,
  score: player.score,
});

// On construit l'objet champ par champ plutôt que de copier le joueur :
// un champ privé ajouté plus tard à Player ne fuitera donc pas par accident.
export const toRoomPublic = (room: Room): RoomPublic => ({
  code: room.code,
  status: room.status,
  hostId: room.hostId,
  players: [...room.players.values()].map(toPlayerPublic),
});
