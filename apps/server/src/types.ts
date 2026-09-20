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

export type JoinRoomPayload = {
  roomCode: string;
  user: { id: string; name: string };
};

export type RoomUpdatePayload = {
  roomCode: string;
  state: Pick<RoomState, "closets">;
  userId: string;
};

export type ServerToClientEvents = {
  "room:state": (state: RoomState) => void;
  "room:error": (message: string) => void;
  "presence:update": (users: RoomUser[]) => void;
};

export type ClientToServerEvents = {
  "room:join": (payload: JoinRoomPayload) => void;
  "room:update": (payload: RoomUpdatePayload) => void;
  "room:leave": (payload: { roomCode: string; userId: string }) => void;
};
