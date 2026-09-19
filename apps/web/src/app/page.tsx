"use client";

import { FormEvent, useState } from "react";

const boardItems = [
  { name: "Soft knit", className: "item-knit", price: "$68" },
  { name: "Wide leg", className: "item-pants", price: "$92" },
  { name: "Crescent bag", className: "item-bag", price: "$48" },
];

export default function Home() {
  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notice, setNotice] = useState("");

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(
      roomName.trim()
        ? `Your room “${roomName.trim()}” is ready to set up.`
        : "Give your room a name to get started.",
    );
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(
      roomCode.trim()
        ? `Joining room ${roomCode.trim().toUpperCase()} as ${displayName.trim() || "guest"}.`
        : "Enter a room code to join your friends.",
    );
  }

  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="wordmark" href="#top" aria-label="Closet home">
          <span className="wordmark-mark">C</span>
          closet
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
                <span className="panel-number">01</span>
                <span>Create a new room</span>
              </div>
              <label htmlFor="room-name">Name your moodboard</label>
              <div className="input-row">
                <input id="room-name" value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="e.g. Weekend in Lisbon" />
                <button type="submit" className="primary-button" aria-label="Create room">Create <span aria-hidden="true">→</span></button>
              </div>
            </form>
            <form className="action-panel join-panel" onSubmit={handleJoin}>
              <div className="panel-heading">
                <span className="panel-number">02</span>
                <span>Join someone&apos;s room</span>
              </div>
              <label htmlFor="room-code">Have an invite code?</label>
              <div className="join-fields">
                <input id="room-code" value={roomCode} onChange={(event) => setRoomCode(event.target.value)} placeholder="ROOM CODE" />
                <input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
                <button type="submit" className="text-button" aria-label="Join room">Join <span aria-hidden="true">↗</span></button>
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
