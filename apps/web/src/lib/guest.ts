import { useSyncExternalStore } from "react";

export type Guest = {
  id: string;
  name: string;
};

const STORAGE_KEY = "closet-guest";
const CHANGE_EVENT = "closet-guest:change";

function generateId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function readGuestRaw(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
}

export function loadGuest(): Guest | null {
  try {
    const saved = readGuestRaw();
    return saved ? (JSON.parse(saved) as Guest) : null;
  } catch {
    return null;
  }
}

export function saveGuest(name: string): Guest {
  const trimmed = name.trim() || "Guest";
  const guest: Guest = { id: loadGuest()?.id || generateId(), name: trimmed };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(guest));
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return guest;
}

/** Pins the local identity to a known id (used when a phone account signs in). */
export function setIdentity(id: string, name: string): Guest {
  const current = loadGuest();
  const guest: Guest = { id, name: name.trim() || current?.name || "Guest" };
  if (current?.id === guest.id && current.name === guest.name) return current;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(guest));
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return guest;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useGuest(): Guest | null {
  const raw = useSyncExternalStore(subscribe, readGuestRaw, () => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Guest;
  } catch {
    return null;
  }
}
