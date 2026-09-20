import { io, type Socket } from "socket.io-client";

export type BoardItem = {
  id: string;
  name: string;
  imageUrl: string;
  sourceUrl: string;
  category: string;
  price: string;
  x: number;
  y: number;
};

export type Closet = {
  id: string;
  name: string;
  items: BoardItem[];
};

export type RoomUser = {
  id: string;
  name: string;
  online: boolean;
};

export type RoomState = {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  closets: Closet[];
  users: RoomUser[];
};

type ServerToClientEvents = {
  "room:state": (state: RoomState) => void;
  "room:error": (message: string) => void;
  "presence:update": (users: RoomUser[]) => void;
};

type ClientToServerEvents = {
  "room:join": (payload: { roomCode: string; user: { id: string; name: string } }) => void;
  "room:update": (payload: { roomCode: string; state: Pick<RoomState, "closets">; userId: string }) => void;
  "room:leave": (payload: { roomCode: string; userId: string }) => void;
};

export type ClosetSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function connectToRoom() {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:4000` : "http://localhost:4000");
  return io(socketUrl, {
    transports: ["websocket"],
  });
}
