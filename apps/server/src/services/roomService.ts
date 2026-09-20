import { randomUUID } from "node:crypto";
import { getRoomByCode as getPersistedRoom, saveRoom } from "./database.js";
import type { RoomState } from "../types.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateCode() {
  let code = "";
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
  } while (getPersistedRoom(code));
  return code;
}

export function createRoom(name: string, closets: RoomState["closets"]): RoomState {
  const room: RoomState = {
    id: randomUUID(),
    code: generateCode(),
    name,
    createdAt: new Date().toISOString(),
    closets,
    users: [],
  };
  saveRoom(room);
  return room;
}

export function getRoomByCode(rawCode: string) {
  return getPersistedRoom(normalizeCode(rawCode));
}
