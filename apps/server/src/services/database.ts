import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Closet, RoomState, RoomUser } from "../types.js";

const databasePath = process.env.DATABASE_PATH || resolve(process.cwd(), "data/closet.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    closets_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS room_users (
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    online INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

type RoomRow = { id: string; code: string; name: string; created_at: string; closets_json: string };
type UserRow = { id: string; name: string; online: number };

function usersForRoom(roomId: string): RoomUser[] {
  return (database.prepare(`
    SELECT users.id, users.name, room_users.online
    FROM room_users JOIN users ON users.id = room_users.user_id
    WHERE room_users.room_id = ?
    ORDER BY users.name COLLATE NOCASE
  `).all(roomId) as UserRow[]).map((user) => ({ ...user, online: Boolean(user.online) }));
}

export function saveRoom(room: Pick<RoomState, "id" | "code" | "name" | "createdAt" | "closets">) {
  database.prepare(`
    INSERT INTO rooms (id, code, name, created_at, closets_json)
    VALUES (@id, @code, @name, @createdAt, @closets)
  `).run({ ...room, closets: JSON.stringify(room.closets) });
}

export function getRoomByCode(code: string): RoomState | undefined {
  const room = database.prepare("SELECT * FROM rooms WHERE code = ?").get(code) as RoomRow | undefined;
  if (!room) return undefined;
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    createdAt: room.created_at,
    closets: JSON.parse(room.closets_json) as Closet[],
    users: usersForRoom(room.id),
  };
}

export function updateRoomClosets(code: string, closets: Closet[]) {
  database.prepare("UPDATE rooms SET closets_json = ? WHERE code = ?").run(JSON.stringify(closets), code);
}

export function upsertRoomUser(roomId: string, user: { id: string; name: string }, online: boolean) {
  database.prepare("INSERT INTO users (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name").run(user.id, user.name);
  database.prepare(`
    INSERT INTO room_users (room_id, user_id, online) VALUES (?, ?, ?)
    ON CONFLICT(room_id, user_id) DO UPDATE SET online = excluded.online
  `).run(roomId, user.id, online ? 1 : 0);
}

export function usersForRoomCode(code: string) {
  const room = database.prepare("SELECT id FROM rooms WHERE code = ?").get(code) as { id: string } | undefined;
  return room ? usersForRoom(room.id) : [];
}
