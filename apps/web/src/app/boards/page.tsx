"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PhoneAuthDialog } from "@/components/PhoneAuth";
import { supabase } from "@/lib/supabase";
import { displayNameFor, formatPhone, signOut, useSession } from "@/lib/auth";
import type { RoomSummary } from "@/lib/api";

export default function BoardsPage() {
  const { session, loading } = useSession();
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [notice, setNotice] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      setRooms(null);
      return;
    }
    let cancelled = false;

    async function loadRooms(id: string) {
      const { data: memberships, error } = await supabase
        .from("room_members")
        .select("room_id, joined_id")
        .eq("user_id", id)
        .order("joined_id", { ascending: false });
      if (cancelled) return;
      if (error) {
        setNotice(`Couldn't load your boards: ${error.message}`);
        setRooms([]);
        return;
      }

      const roomIds = Array.from(new Set((memberships || []).map((row) => row.room_id)));
      if (!roomIds.length) {
        setRooms([]);
        return;
      }

      const { data, error: roomsError } = await supabase
        .from("rooms")
        .select("id, code, name, created_at")
        .in("id", roomIds);
      if (cancelled) return;
      if (roomsError) {
        setNotice(`Couldn't load your boards: ${roomsError.message}`);
        setRooms([]);
        return;
      }

      // Preserve the membership ordering (most recently joined first).
      const byId = new Map((data || []).map((room) => [room.id, room]));
      setRooms(
        roomIds
          .map((id) => byId.get(id))
          .filter((room): room is NonNullable<typeof room> => Boolean(room))
          .map((room) => ({ id: room.id, code: room.code, name: room.name, createdAt: room.created_at }))
      );
    }

    void loadRooms(userId);
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="Main navigation">
        <Link className="wordmark" href="/" aria-label="intracloset home">
          <Logo className="wordmark-mark" />
          intracloset
        </Link>
        <div className="nav-note">
          <span className="status-dot" />
          Your saved rooms
        </div>
        {session ? (
          <button type="button" className="nav-link" onClick={() => void signOut()}>Sign out</button>
        ) : (
          <button type="button" className="nav-link" onClick={() => setAuthOpen(true)}>Sign in ↗</button>
        )}
      </nav>

      <section className="boards-page">
        <header className="boards-head">
          <p className="eyebrow">Your boards</p>
          <h1>Everything you&apos;ve styled.</h1>
          {session && (
            <p className="hero-intro">
              Signed in as {displayNameFor(session)} · {formatPhone(session.user.phone)}
            </p>
          )}
        </header>

        {loading && <p className="boards-empty">Loading…</p>}

        {!loading && !session && (
          <div className="boards-empty">
            <p>Sign in with your phone number to keep your boards and find them from any device.</p>
            <button type="button" className="primary-button" onClick={() => setAuthOpen(true)}>
              Sign in <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        {session && rooms === null && !notice && <p className="boards-empty">Gathering your rooms…</p>}

        {session && rooms?.length === 0 && (
          <div className="boards-empty">
            <p>No boards yet. Create one and it&apos;ll show up here.</p>
            <Link className="primary-button" href="/">Create a room <span aria-hidden="true">→</span></Link>
          </div>
        )}

        {rooms && rooms.length > 0 && (
          <ul className="boards-grid">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link className="board-card" href={`/room/${room.code}`}>
                  <span className="board-card-name">{room.name}</span>
                  <span className="board-card-code">{room.code}</span>
                  <span className="board-card-date">
                    {new Date(room.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {notice && <p className="form-notice" role="status">{notice}</p>}
      </section>

      {authOpen && <PhoneAuthDialog onClose={() => setAuthOpen(false)} />}
    </main>
  );
}
