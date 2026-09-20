"use client";

import { FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ApiError, getRoom, normalizeRoomCode, type RoomSummary } from "@/lib/api";
import { saveGuest, useGuest } from "@/lib/guest";

type BoardItem = {
  id: string;
  name: string;
  imageUrl: string;
  sourceUrl: string;
  category: string;
  price: string;
  x: number;
  y: number;
};

const starterItems: BoardItem[] = [
  {
    id: "starter-knit",
    name: "Coral knit",
    imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=500&q=85",
    sourceUrl: "https://www.example.com/",
    category: "tops",
    price: "$68",
    x: 14,
    y: 18,
  },
  {
    id: "starter-pants",
    name: "Wide leg trousers",
    imageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=500&q=85",
    sourceUrl: "https://www.example.com/",
    category: "bottoms",
    price: "$92",
    x: 43,
    y: 22,
  },
  {
    id: "starter-bag",
    name: "Crescent bag",
    imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=500&q=85",
    sourceUrl: "https://www.example.com/",
    category: "accessories",
    price: "$48",
    x: 73,
    y: 58,
  },
];

const emptyForm = { name: "", imageUrl: "", sourceUrl: "", category: "tops", price: "" };

function getStoredRoom(roomId: string) {
  if (typeof window === "undefined") return { name: "Style room", items: starterItems };
  const saved = window.localStorage.getItem(`closet-room:${roomId}`);
  if (!saved) return { name: "Style room", items: starterItems };
  try {
    const parsed = JSON.parse(saved) as { name?: string; items?: BoardItem[] };
    return { name: parsed.name || "Style room", items: parsed.items || starterItems };
  } catch {
    return { name: "Style room", items: starterItems };
  }
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const boardRef = useRef<HTMLDivElement>(null);
  const roomCode = normalizeRoomCode(roomId);
  const guest = useGuest();
  const guestName = guest?.name || "You";
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [roomStatus, setRoomStatus] = useState<"loading" | "ready" | "not-found" | "offline">(() => (roomCode ? "loading" : "not-found"));
  const [roomName, setRoomName] = useState(() => getStoredRoom(roomId).name);
  const [items, setItems] = useState<BoardItem[]>(() => getStoredRoom(roomId).items);
  const [form, setForm] = useState(emptyForm);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get("guest");
    if (fromQuery) saveGuest(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;
    getRoom(roomCode)
      .then((found) => {
        if (cancelled) return;
        setRoom(found);
        setRoomName(found.name);
        setRoomStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setRoomStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "offline");
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.price.replace(/[^0-9.]/g, "")) || 0), 0);
  }, [items]);

  useEffect(() => {
    if (!roomId) return;
    window.localStorage.setItem(`closet-room:${roomId}`, JSON.stringify({ name: roomName, items }));
  }, [items, roomId, roomName]);

  function updateForm(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setNotice("Add a name so everyone knows what the piece is.");
      return;
    }
    if (!form.sourceUrl.trim()) {
      setNotice("Paste the product page link so your friends can shop it.");
      return;
    }

    const newItem: BoardItem = {
      id: `${Date.now()}`,
      name: form.name.trim(),
      imageUrl: form.imageUrl.trim(),
      sourceUrl: form.sourceUrl.trim(),
      category: form.category,
      price: form.price.trim() || "Price TBD",
      x: 10 + ((items.length * 17) % 70),
      y: 12 + ((items.length * 23) % 58),
    };
    setItems((current) => [...current, newItem]);
    setActiveId(newItem.id);
    setForm(emptyForm);
    setNotice(`${newItem.name} added to the board.`);
  }

  function moveItem(event: PointerEvent<HTMLDivElement>) {
    if (!draggingId || !boardRef.current) return;
    const bounds = boardRef.current.getBoundingClientRect();
    const itemWidth = 132;
    const itemHeight = 190;
    const x = Math.max(1, Math.min(94, ((event.clientX - bounds.left - itemWidth / 2) / bounds.width) * 100));
    const y = Math.max(2, Math.min(84, ((event.clientY - bounds.top - itemHeight / 2) / bounds.height) * 100));
    setItems((current) => current.map((item) => item.id === draggingId ? { ...item, x, y } : item));
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setActiveId(null);
    setNotice("Piece removed from the board.");
  }

  async function copyToClipboard(kind: "link" | "code") {
    await navigator.clipboard.writeText(kind === "link" ? `${window.location.origin}/room/${roomCode}` : roomCode);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }

  if (roomStatus === "not-found") {
    return (
      <main className="room-shell">
        <header className="room-header">
          <Link className="wordmark" href="/" aria-label="Back to closet home"><span className="wordmark-mark">C</span>closet</Link>
        </header>
        <section className="room-empty">
          <p className="eyebrow">Room not found</p>
          <h1>No room with<br /><em>code {roomCode || "—"}.</em></h1>
          <p>Double-check the code with whoever shared it, or start a fresh room.</p>
          <Link className="outline-button" href="/">Back to closet <span aria-hidden="true">↗</span></Link>
        </section>
      </main>
    );
  }

  return (
    <main className="room-shell">
      <header className="room-header">
        <Link className="wordmark" href="/" aria-label="Back to closet home"><span className="wordmark-mark">C</span>closet</Link>
        <div className="room-heading">
          <span className="status-dot" />
          <div><span className="room-kicker">Shared moodboard{roomStatus === "offline" && " · offline"}</span><h1>{roomName}</h1></div>
        </div>
        <div className="room-actions-bar">
          <div className="room-people"><i className="avatar avatar-one">{guestName.slice(0, 1).toUpperCase()}</i><i className="avatar avatar-two">M</i><i className="avatar avatar-three">S</i><span>3 online</span></div>
          <button className="room-code" onClick={() => copyToClipboard("code")} title="Copy room code" aria-label="Copy room code"><span className="room-kicker">Code</span><strong>{copied === "code" ? "Copied" : room?.code || roomCode}</strong></button>
          <button className="outline-button" onClick={() => copyToClipboard("link")}>{copied === "link" ? "Copied" : "Share room"} <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <section className="room-layout">
        <div className="board-column">
          <div className="board-toolbar"><div><span className="live-mark">● LIVE</span><span className="toolbar-muted">Drag pieces to arrange your look</span></div><span className="board-count">{items.length} pieces / ${total.toFixed(0)} total</span></div>
          <div className="moodboard" ref={boardRef} onPointerMove={moveItem} onPointerUp={() => setDraggingId(null)} onPointerLeave={() => setDraggingId(null)}>
            <div className="moodboard-grid" />
            <div className="moodboard-note">build<br /><em>the look</em></div>
            <div className="board-cursor cursor-ziana"><span />{guestName}</div>
            <div className="board-cursor cursor-maya"><span />Maya</div>
            {items.map((item) => (
              <article
                className={`placed-item ${activeId === item.id ? "is-active" : ""} ${draggingId === item.id ? "is-dragging" : ""}`}
                key={item.id}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setActiveId(item.id); setDraggingId(item.id); }}
              >
                <div className="placed-image-wrap">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="image-placeholder">{item.category.slice(0, 1).toUpperCase()}</div>}
                  {activeId === item.id && <button className="remove-item" onPointerDown={(event) => event.stopPropagation()} onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}>×</button>}
                </div>
                <div className="placed-meta"><strong>{item.name}</strong><span>{item.price} · {item.category}</span></div>
              </article>
            ))}
          </div>
        </div>

        <aside className="room-sidebar">
          <div className="sidebar-intro"><p className="eyebrow">Add to the room</p><h2>Bring in<br /><em>your finds.</em></h2><p>Paste a product link and your friends can see, move, and shop it from the board.</p></div>
          <form className="add-item-form" onSubmit={addItem}>
            <label htmlFor="item-name">Item name</label>
            <input id="item-name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Vintage leather jacket" />
            <label htmlFor="source-url">Product link <span className="required">required</span></label>
            <input id="source-url" type="url" value={form.sourceUrl} onChange={(event) => updateForm("sourceUrl", event.target.value)} placeholder="https://shop.com/item" />
            <label htmlFor="image-url">Image link <span>optional</span></label>
            <input id="image-url" type="url" value={form.imageUrl} onChange={(event) => updateForm("imageUrl", event.target.value)} placeholder="https://.../image.jpg" />
            <div className="form-split"><div><label htmlFor="category">Category</label><select id="category" value={form.category} onChange={(event) => updateForm("category", event.target.value)}><option>tops</option><option>bottoms</option><option>shoes</option><option>outerwear</option><option>dresses</option><option>accessories</option></select></div><div><label htmlFor="price">Price</label><input id="price" value={form.price} onChange={(event) => updateForm("price", event.target.value)} placeholder="$120" /></div></div>
            <button className="add-button" type="submit"><span aria-hidden="true">+</span> Add to moodboard</button>
          </form>
          {notice && <p className="room-notice" role="status">{notice}</p>}
          <div className="sidebar-divider" />
          <div className="room-tip"><span>TIP</span><p>Click a piece to select it. Drag from the image to make space for someone else&apos;s find.</p></div>
        </aside>
      </section>
    </main>
  );
}
