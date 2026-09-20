import { supabase } from "@/lib/supabase";

export type RoomSummary = {
  id: string;
  code: string;
  name: string;
  createdAt: string;
};

function getApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:4000`;
  return "http://localhost:4000";
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError(0, "Couldn't reach the room server. Is it running?");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, body.error || "Something went wrong.");
  return body as T;
}

export function normalizeRoomCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function createRoom(name: string): Promise<RoomSummary> {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  const { data, error } = await supabase
    .from("rooms")
    .insert({
      name: name.trim() || "Style room",
      code,
    })
    .select("id, code, name, created_at")
    .single();

  if (error) {
    throw new ApiError(0, error.message);
  }

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    createdAt: data.created_at,
  };
}

export async function getRoom(code: string): Promise<RoomSummary> {
  const normalizedCode = normalizeRoomCode(code);

  const { data, error } = await supabase
    .from("rooms")
    .select("id, code, name, created_at")
    .eq("code", normalizedCode)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ApiError(404, "Room not found.");
    }

    throw new ApiError(0, error.message);
  }

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    createdAt: data.created_at,
  };
}
