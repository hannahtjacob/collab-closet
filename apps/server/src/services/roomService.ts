import { randomUUID } from "node:crypto";

export type Room = {
  id: string;
  code: string;
  name: string;
  createdAt: string;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

const roomsByCode = new Map<string, Room>();

export function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateCode() {
  let code = "";
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
  } while (roomsByCode.has(code));
  return code;
}

export function createRoom(name: string): Room {
  const room: Room = { id: randomUUID(), code: generateCode(), name, createdAt: new Date().toISOString() };
  roomsByCode.set(room.code, room);
  return room;
}

export function getRoomByCode(rawCode: string): Room | undefined {
  return roomsByCode.get(normalizeCode(rawCode));
}
