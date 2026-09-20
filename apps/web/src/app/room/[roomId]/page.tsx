"use client";

import { ChangeEvent, DragEvent, FormEvent, PointerEvent, startTransition, useEffect, useMemo, useRef, useState } from "react";
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

type Closet = {
  id: string;
  name: string;
  items: BoardItem[];
};

type ItemForm = typeof emptyForm;

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

function createDefaultClosets(ownerName: string): Closet[] {
  return [
    { id: "owner", name: ownerName, items: [starterItems[0]] },
    { id: "maya", name: "Maya", items: [starterItems[1]] },
    { id: "sam", name: "Sam", items: [starterItems[2]] },
  ];
}

function getStoredRoom(roomId: string, ownerName: string) {
  if (typeof window === "undefined") return { name: "Style room", closets: createDefaultClosets(ownerName) };
  const saved = window.localStorage.getItem(`closet-room:${roomId}`);
  if (!saved) return { name: "Style room", closets: createDefaultClosets(ownerName) };
  try {
    const parsed = JSON.parse(saved) as { name?: string; items?: BoardItem[]; closets?: Closet[] };
    if (parsed.closets?.length) return { name: parsed.name || "Style room", closets: parsed.closets };
    return {
      name: parsed.name || "Style room",
      closets: [{ id: "owner", name: ownerName, items: parsed.items || starterItems }, { id: "maya", name: "Maya", items: [] }, { id: "sam", name: "Sam", items: [] }],
    };
  } catch {
    return { name: "Style room", closets: createDefaultClosets(ownerName) };
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
  const [roomName, setRoomName] = useState("Style room");
  const [closets, setClosets] = useState<Closet[]>(() => createDefaultClosets(guestName));
  const [closetIndex, setClosetIndex] = useState(0);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [photoPreview, setPhotoPreview] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [detailsItemId, setDetailsItemId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isBoardDropActive, setIsBoardDropActive] = useState(false);
  const activeCloset = closets[closetIndex] || closets[0];
  const items = useMemo(() => activeCloset?.items || [], [activeCloset]);
  const closetLabel = activeCloset?.name === "You" ? "Your closet" : `${activeCloset?.name}'s closet`;

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
    const storedRoom = getStoredRoom(roomId, guestName);
    startTransition(() => {
      setRoomName(storedRoom.name);
      setClosets(storedRoom.closets);
    });
  }, [guestName, roomId]);

  useEffect(() => {
    if (!roomId || roomName === "Style room") return;
    window.localStorage.setItem(`closet-room:${roomId}`, JSON.stringify({ name: roomName, closets }));
  }, [closets, roomId, roomName]);

  function updateActiveItems(update: (current: BoardItem[]) => BoardItem[]) {
    setClosets((current) => current.map((closet, index) => index === closetIndex ? { ...closet, items: update(closet.items) } : closet));
  }

  function cycleCloset(direction: number) {
    setActiveId(null);
    setClosetIndex((current) => (current + direction + closets.length) % closets.length);
  }

  function updateForm(field: keyof ItemForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editItem(item: BoardItem) {
    setEditingItemId(item.id);
    setDetailsItemId(null);
    setPhotoPreview(item.imageUrl.startsWith("data:") ? item.imageUrl : "");
    setForm({
      category: item.category,
      imageUrl: item.imageUrl,
      name: item.name,
      price: item.price === "Price TBD" ? "" : item.price,
      sourceUrl: item.sourceUrl,
    });
    setNotice(`Editing ${item.name}. Update the details and save.`);
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = typeof reader.result === "string" ? reader.result : "";
      setPhotoPreview(imageUrl);
      setForm((current) => ({ ...current, imageUrl }));
      setNotice("Photo ready. Add a name, then place it on the board.");
    };
    reader.readAsDataURL(file);
  }

  function addDroppedPhoto(file: File, clientX?: number, clientY?: number) {
    const isImage = file.type.startsWith("image/") || /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name);
    if (!isImage) {
      setNotice("Drop an image file or screenshot onto the board.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = typeof reader.result === "string" ? reader.result : "";
      const bounds = boardRef.current?.getBoundingClientRect();
      const x = bounds && clientX ? Math.max(8, Math.min(88, ((clientX - bounds.left) / bounds.width) * 100)) : 50;
      const y = bounds && clientY ? Math.max(18, Math.min(82, ((clientY - bounds.top) / bounds.height) * 100)) : 45;
      const newItem: BoardItem = {
        id: `${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, "") || "Screenshot find",
        imageUrl,
        sourceUrl: "",
        category: "tops",
        price: "Price TBD",
        x,
        y,
      };
      updateActiveItems((current) => [...current, newItem]);
      setActiveId(newItem.id);
      editItem(newItem);
      setNotice(`${newItem.name} dropped into ${closetLabel}. Add details in the form if you need them.`);
    };
    reader.readAsDataURL(file);
  }

  function addDroppedImageUrl(imageUrl: string, clientX?: number, clientY?: number) {
    if (!imageUrl) return;
    const bounds = boardRef.current?.getBoundingClientRect();
    const x = bounds && clientX ? Math.max(8, Math.min(88, ((clientX - bounds.left) / bounds.width) * 100)) : 50;
    const y = bounds && clientY ? Math.max(18, Math.min(82, ((clientY - bounds.top) / bounds.height) * 100)) : 45;
    const newItem: BoardItem = {
      id: `${Date.now()}`,
      name: "Dropped clothing find",
      imageUrl,
      sourceUrl: imageUrl,
      category: "tops",
      price: "Price TBD",
      x,
      y,
    };
    updateActiveItems((current) => [...current, newItem]);
    setActiveId(newItem.id);
    setNotice(`Image dropped into ${closetLabel}. Add details in the form if you need them.`);
  }

  function handleBoardDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsBoardDropActive(true);
  }

  function handleBoardDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsBoardDropActive(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      addDroppedPhoto(file, event.clientX, event.clientY);
      return;
    }

    const uri = event.dataTransfer.getData("text/uri-list").split("\n").find((value) => value && !value.startsWith("#")) || event.dataTransfer.getData("text/plain");
    if (uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("data:image/")) {
      addDroppedImageUrl(uri, event.clientX, event.clientY);
      return;
    }

    setNotice("That drag did not include an image file. Try dragging the screenshot file itself.");
  }

  async function parseProductLink() {
    if (!form.sourceUrl.trim() || isParsing) return;
    setIsParsing(true);
    setNotice("Reading product details...");
    try {
      const response = await fetch("/api/product-preview", {
        body: JSON.stringify({ url: form.sourceUrl.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json() as { ok?: boolean; message?: string; product?: { name?: string; imageUrl?: string; price?: string; category?: string } };
      if (!response.ok || !result.ok || !result.product) {
        setNotice(result.message || "Could not read that page. Enter the details manually.");
        return;
      }

      const supportedCategories = ["tops", "bottoms", "shoes", "outerwear", "dresses", "accessories"];
      const parsedCategory = supportedCategories.find((category) => result.product?.category?.includes(category)) || form.category;
      setForm((current) => ({
        ...current,
        category: parsedCategory,
        imageUrl: result.product?.imageUrl || current.imageUrl,
        name: result.product?.name || current.name,
        price: result.product?.price || current.price,
      }));
      setNotice("Details found. Check them, then add the piece to the board.");
    } catch {
      setNotice("This site could not be reached. Enter the product details manually.");
    } finally {
      setIsParsing(false);
    }
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setNotice("Add a name so everyone knows what the piece is.");
      return;
    }
    if (!form.sourceUrl.trim() && !form.imageUrl.trim()) {
      setNotice("Add a product link or snap a photo of the piece.");
      return;
    }

    if (editingItemId) {
      updateActiveItems((current) => current.map((item) => item.id === editingItemId ? {
        ...item,
        category: form.category,
        imageUrl: form.imageUrl.trim(),
        name: form.name.trim(),
        price: form.price.trim() || "Price TBD",
        sourceUrl: form.sourceUrl.trim(),
      } : item));
      setActiveId(editingItemId);
      setEditingItemId(null);
      setDetailsItemId(null);
      setForm(emptyForm);
      setPhotoPreview("");
      setNotice(`${form.name.trim()} updated.`);
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
    updateActiveItems((current) => [...current, newItem]);
    setActiveId(newItem.id);
    setEditingItemId(null);
    setForm(emptyForm);
    setPhotoPreview("");
    setNotice(`${newItem.name} added to the board.`);
  }

  function moveItem(event: PointerEvent<HTMLDivElement>) {
    if (!draggingId || !boardRef.current) return;
    const bounds = boardRef.current.getBoundingClientRect();
    const itemWidth = 132;
    const itemHeight = 190;
    const x = Math.max(1, Math.min(94, ((event.clientX - bounds.left - itemWidth / 2) / bounds.width) * 100));
    const y = Math.max(2, Math.min(84, ((event.clientY - bounds.top - itemHeight / 2) / bounds.height) * 100));
    updateActiveItems((current) => current.map((item) => item.id === draggingId ? { ...item, x, y } : item));
  }

  function removeItem(itemId: string) {
    updateActiveItems((current) => current.filter((item) => item.id !== itemId));
    setActiveId(null);
    setEditingItemId(null);
    setDetailsItemId(null);
    setNotice("Piece removed from the board.");
  }

  function showItemDetails(item: BoardItem) {
    setActiveId(item.id);
    setDetailsItemId(item.id);
    setEditingItemId(null);
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
          <div className="board-toolbar">
            <div><span className="live-mark">● LIVE</span><span className="toolbar-muted">Drag pieces to arrange your look</span></div>
            <div className="closet-switcher" aria-label="Cycle through closets">
              <button className="arrow-button" onClick={() => cycleCloset(-1)} aria-label="Previous closet">←</button>
              <span><strong>{closetLabel}</strong><small>{closetIndex + 1} / {closets.length}</small></span>
              <button className="arrow-button" onClick={() => cycleCloset(1)} aria-label="Next closet">→</button>
            </div>
            <span className="board-count">{items.length} pieces / ${total.toFixed(0)} total</span>
          </div>
          <div className={`moodboard ${isBoardDropActive ? "is-drop-active" : ""}`} ref={boardRef} onPointerMove={moveItem} onPointerUp={() => setDraggingId(null)} onPointerLeave={() => { setDraggingId(null); setIsBoardDropActive(false); }} onDragOver={handleBoardDragOver} onDragLeave={() => setIsBoardDropActive(false)} onDrop={handleBoardDrop}>
            <div className="moodboard-grid" />
            <div className="moodboard-note">build<br /><em>the look</em></div>
            <div className="drop-hint"><strong>Drop a screenshot here</strong><span>or drag a clothing photo from your desktop</span></div>
            {!items.length && <div className="empty-closet"><strong>{activeCloset?.name} hasn&apos;t added anything yet.</strong><span>Use the form to add the first find to this closet.</span></div>}
            <div className="board-cursor cursor-ziana"><span />{guestName}</div>
            <div className="board-cursor cursor-maya"><span />Maya</div>
            {items.map((item) => (
              <article
                className={`placed-item ${activeId === item.id ? "is-active" : ""} ${draggingId === item.id ? "is-dragging" : ""}`}
                key={item.id}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setActiveId(item.id); setDraggingId(item.id); }}
                onDoubleClick={() => showItemDetails(item)}
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
          {detailsItemId && (() => {
            const detailsItem = items.find((item) => item.id === detailsItemId);
            if (!detailsItem) return null;
            return <div className="item-details-panel">
              <div className="details-heading"><span>Selected piece</span><button type="button" onClick={() => setDetailsItemId(null)} aria-label="Close item details">×</button></div>
              <div className="details-photo">{detailsItem.imageUrl ? <img src={detailsItem.imageUrl} alt={detailsItem.name} /> : <div className="image-placeholder">{detailsItem.category.slice(0, 1).toUpperCase()}</div>}</div>
              <h3>{detailsItem.name}</h3>
              <p>{detailsItem.price} · {detailsItem.category}</p>
              {detailsItem.sourceUrl && <a href={detailsItem.sourceUrl} target="_blank" rel="noreferrer">Open product link ↗</a>}
              <button className="details-edit-button" type="button" onClick={() => editItem(detailsItem)}>Edit details</button>
            </div>;
          })()}
          <div className="sidebar-intro"><p className="eyebrow">{closetLabel}</p><h2>Bring in<br /><em>your finds.</em></h2><p>Paste a product link and add it to the closet currently on display.</p></div>
          <form className="add-item-form" onSubmit={addItem}>
            <div className="form-title-row"><label htmlFor="item-name">{editingItemId ? "Edit piece" : "Add a piece"}</label>{editingItemId && <button type="button" className="cancel-edit" onClick={() => { setEditingItemId(null); setForm(emptyForm); setPhotoPreview(""); }}>Cancel</button>}</div>
            <label className="visually-hidden" htmlFor="item-name">Item name</label>
            <input id="item-name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Vintage leather jacket" />
            <label htmlFor="source-url">Product link <span>optional</span></label>
            <div className="link-input-row"><input id="source-url" type="url" value={form.sourceUrl} onChange={(event) => updateForm("sourceUrl", event.target.value)} onBlur={() => void parseProductLink()} placeholder="https://shop.com/item" /><button className="parse-button" type="button" onClick={() => void parseProductLink()} disabled={isParsing}>{isParsing ? "Reading" : "Autofill"}</button></div>
            <label htmlFor="photo-upload">Or snap a photo <span>camera or library</span></label>
            <label className="photo-dropzone" htmlFor="photo-upload">
              {photoPreview ? <img src={photoPreview} alt="Selected clothing preview" /> : <><strong>+ Add a photo</strong><span>Take a picture or choose one from your device</span></>}
            </label>
            <input className="photo-input" id="photo-upload" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
            <label htmlFor="image-url">Image link <span>optional fallback</span></label>
            <input id="image-url" type="url" value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl} onChange={(event) => { setPhotoPreview(""); updateForm("imageUrl", event.target.value); }} placeholder="https://.../image.jpg" />
            <div className="form-split"><div><label htmlFor="category">Category</label><select id="category" value={form.category} onChange={(event) => updateForm("category", event.target.value)}><option>tops</option><option>bottoms</option><option>shoes</option><option>outerwear</option><option>dresses</option><option>accessories</option></select></div><div><label htmlFor="price">Price</label><input id="price" value={form.price} onChange={(event) => updateForm("price", event.target.value)} placeholder="$120" /></div></div>
            <button className="add-button" type="submit"><span aria-hidden="true">{editingItemId ? "✓" : "+"}</span> {editingItemId ? "Save item details" : "Add to moodboard"}</button>
          </form>
          {notice && <p className="room-notice" role="status">{notice}</p>}
          <div className="sidebar-divider" />
          <div className="room-tip"><span>TIP</span><p>Click a piece to select it. Drag from the image to make space for someone else&apos;s find.</p></div>
        </aside>
      </section>
    </main>
  );
}
