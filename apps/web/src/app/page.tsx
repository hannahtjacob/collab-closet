"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ApiError, createRoom, getRoom, normalizeRoomCode } from "@/lib/api";
import { saveGuest } from "@/lib/guest";

const boardItems = [
  { name: "Soft knit", className: "item-knit", price: "$68" },
  { name: "Wide leg", className: "item-pants", price: "$92" },
  { name: "Crescent bag", className: "item-bag", price: "$48" },
];

export default function Home() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = roomName.trim();
    if (!trimmedName) {
      setNotice("Give your room a name to get started.");
      return;
    }

    setBusy("create");
    setNotice("");
    try {
      const room = await createRoom(trimmedName);
      saveGuest(creatorName);
      router.push(`/room/${room.code}`);
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Couldn't create the room. Try again.");
      setBusy(null);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeRoomCode(roomCode);
    if (!code) {
      setNotice("Enter a room code to join your friends.");
      return;
    }

    setBusy("join");
    setNotice("");
    try {
      const room = await getRoom(code);
      saveGuest(joinName);
      router.push(`/room/${room.code}`);
    } catch (error) {
      setNotice(error instanceof ApiError && error.status === 404 ? `No room found for code ${code}. Double-check it with your friend.` : error instanceof ApiError ? error.message : "Couldn't join the room. Try again.");
      setBusy(null);
    }
  }

  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="wordmark" href="#top" aria-label="intracloset home">
          <Logo className="wordmark-mark" />
          intracloset
        </a>
        <div className="nav-note">
          <span className="status-dot" />
          Make room for good taste
        </div>
        <a className="nav-link" href="#join">
          Join a room <span aria-hidden="true">↗</span>
        </a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">A shared space for personal style</p>
          <h1>Shop together,<br /><em>even when you&apos;re apart.</em></h1>
          <p className="hero-intro">
            Pull your favorite pieces into one room, get honest opinions, and find the outfit everyone wants to wear.
          </p>
          <div className="room-actions" id="join">
            <form className="action-panel create-panel" onSubmit={handleCreate}>
              <div className="panel-heading">
                <span>Create a new room</span>
              </div>
              <label htmlFor="room-name">Name your moodboard</label>
              <div className="input-row">
                <input id="room-name" value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="e.g. Weekend in Lisbon" />
                <input id="creator-name" value={creatorName} onChange={(event) => setCreatorName(event.target.value)} placeholder="Your name" aria-label="Your name" />
                <button type="submit" className="primary-button" aria-label="Create room" disabled={busy !== null}>{busy === "create" ? "Creating…" : "Create"} <span aria-hidden="true">→</span></button>
              </div>
            </form>
            <form className="action-panel join-panel" onSubmit={handleJoin}>
              <div className="panel-heading">
                <span>Join someone else&apos;s room</span>
              </div>
              <label htmlFor="room-code">Have an invite code?</label>
              <div className="join-fields">
                <input id="room-code" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
                <input id="display-name" value={joinName} onChange={(event) => setJoinName(event.target.value)} placeholder="Your name" />
                <button type="submit" className="text-button" aria-label="Join room" disabled={busy !== null}>{busy === "join" ? "Joining…" : "Join"} <span aria-hidden="true">↗</span></button>
              </div>
            </form>
          </div>
          {notice && <p className="form-notice" role="status">{notice}</p>}
        </div>

        <div className="preview-wrap" aria-label="Preview of a collaborative outfit board">
          <div className="preview-label label-top">MAYA&apos;S BOARD <span>● LIVE</span></div>
          <div className="board-preview">
            <div className="board-grid" />
            <div className="board-title">soft<br /><i>structure</i></div>
            {boardItems.map((item) => (
              <div className={`board-item ${item.className}`} key={item.name}>
                <div className="product-shape" />
                <span>{item.name}</span>
                <small>{item.price}</small>
              </div>
            ))}
            <div className="cursor cursor-one"><span />Ziana</div>
            <div className="cursor cursor-two"><span />Maya</div>
            <div className="reaction">♥</div>
          </div>
          <div className="preview-footer">
            <span><i className="avatar avatar-one">Z</i><i className="avatar avatar-two">M</i><i className="avatar avatar-three">S</i></span>
            <span>3 friends styling together <b>↗</b></span>
          </div>
        </div>
      </section>

      <footer className="footer-note">
        <span>01 / 03</span>
        <span>One room. Many opinions. Better outfits.</span>
        <span>Scroll to explore ↓</span>
      </footer>
      <div className="accent-sticker" aria-hidden="true">STYLE<br /><span>in sync</span></div>
      </main>
  );
}
