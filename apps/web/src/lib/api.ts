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

export function createRoom(name: string) {
  return request<RoomSummary>("/rooms", { method: "POST", body: JSON.stringify({ name }) });
}

export function getRoom(code: string) {
  return request<RoomSummary>(`/rooms/${encodeURIComponent(normalizeRoomCode(code))}`);
}
