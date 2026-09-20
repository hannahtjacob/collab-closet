"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { clearGuest, setIdentity } from "@/lib/guest";

/** Turns whatever the user typed into E.164, defaulting to +1 for 10-digit US numbers. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.length >= 8 ? digits : null;
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  return null;
}

export function formatPhone(phone: string | undefined): string {
  if (!phone) return "";
  const withPlus = phone.startsWith("+") ? phone : `+${phone}`;
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(withPlus);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : withPlus;
}

export function displayNameFor(session: Session | null): string {
  const meta = session?.user.user_metadata as { display_name?: string } | undefined;
  return meta?.display_name || formatPhone(session?.user.phone);
}

export async function sendCode(phone: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw new Error(error.message);
}

export async function confirmCode(phone: string, token: string, name: string) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) throw new Error(error.message);
  const user = data.user;
  if (!user) throw new Error("Couldn't verify that code. Try again.");

  const trimmed = name.trim();
  if (trimmed && trimmed !== user.user_metadata?.display_name) {
    await supabase.auth.updateUser({ data: { display_name: trimmed } });
  }
  return user;
}

export async function signOut() {
  await supabase.auth.signOut();
  clearGuest();
}

/**
 * Keeps the local guest identity in sync with the Supabase session so that room
 * membership, placements and reactions are all keyed to the same user id.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    setIdentity(session.user.id, displayNameFor(session));
  }, [session]);

  return { session, loading };
}
