"use client";
import { supabase } from "@/lib/supabase";
  import type { PointerEvent } from "react";
import { ChangeEvent, DragEvent, FormEvent, startTransition, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ApiError, getRoom, normalizeRoomCode, type RoomSummary } from "@/lib/api";
import { saveGuest, useGuest } from "@/lib/guest";
type BoardItem = {
  id: string;
  productId: string;
  addedBy?: string;
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
  memberId?: string;
  name: string;
  items: BoardItem[];
};

type FeedbackItem = {
  id: string;
  room_id: string;
  product_id: string;
  reaction: string;
  comment: string;
};

const reactionOptions = ["❤️", "🔥", "👏", "👎", "✨"];

type ItemForm = typeof emptyForm;

const starterItems: BoardItem[] = [
  {
    id: "starter-knit",
    productId: "starter-knit-product",
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
    productId: "starter-pants-product",
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
    productId: "starter-bag-product",
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
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, moved: false });
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isBoardDropActive, setIsBoardDropActive] = useState(false);
  const [allFeedback, setAllFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackReaction, setFeedbackReaction] = useState("❤️");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const activeCloset = closets[closetIndex] || closets[0];
  const items = useMemo(() => activeCloset?.items || [], [activeCloset]);
  const activeItem = items.find((item) => item.id === activeId);
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

  useEffect(() => {
    if (!room?.id || !guest?.id) return;
    let cancelled = false;
    const roomId = room.id;
    const userId = guest.id;

    async function loadMembers() {
      const { data: members, error } = await supabase
        .from("room_members")
        .select("id, room_id, user_id, joined_id")
        .eq("room_id", roomId)
        .order("joined_id", { ascending: true });
      if (cancelled) return;
      if (error) {
        setNotice(`Couldn't load room members: ${error.message}`);
        return;
      }

      let rows = members || [];
      let current = rows.find((member) => member.user_id === userId);
      if (!current) {
        const { data: joined, error: joinError } = await supabase
          .from("room_members")
          .insert({ room_id: roomId, user_id: userId })
          .select("id, room_id, user_id, joined_id")
          .single();
        if (joinError || !joined) {
          setNotice(`Couldn't join this room: ${joinError?.message || "member record was not created"}`);
          return;
        }
        current = joined;
        rows = [...rows, joined];
      }

      setClosets(rows.map((member, index) => ({
        id: member.user_id,
        memberId: member.id,
        name: member.user_id === userId ? guestName : `Member ${index + 1}`,
        items: [],
      })));
      const currentIndex = rows.findIndex((member) => member.id === current?.id);
      setClosetIndex(Math.max(0, currentIndex));
    }

    void loadMembers();
    return () => { cancelled = true; };
  }, [guest?.id, guestName, room?.id]);

  useEffect(() => {
    if (!room?.id || !closets.length) return;
    const roomId = room.id;
    let cancelled = false;

    async function hydratePlacement(placement: { id: string; product_id: string; added_by: string; x: number; y: number }) {
      const { data: product, error } = await supabase.from("products").select("id, name, image_url, category, price").eq("id", placement.product_id).single();
      if (cancelled || error || !product) return;
      const item: BoardItem = {
        id: placement.id,
        productId: product.id,
        addedBy: placement.added_by,
        name: product.name,
        imageUrl: product.image_url || "",
        sourceUrl: "",
        category: product.category || "tops",
        price: product.price !== null && product.price !== undefined ? `$${product.price}` : "Price TBD",
        x: Number(placement.x) || 0,
        y: Number(placement.y) || 0,
      };
      setClosets((current) => current.map((closet) => closet.id === placement.added_by ? { ...closet, items: [...closet.items.filter((existing) => existing.id !== item.id), item] } : closet));
    }

    const channel = supabase
      .channel(`room-products:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_products", filter: `room_id=eq.${roomId}` }, (payload) => void hydratePlacement(payload.new as never))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_products", filter: `room_id=eq.${roomId}` }, (payload) => void hydratePlacement(payload.new as never))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "room_products", filter: `room_id=eq.${roomId}` }, (payload) => {
        const deletedId = String((payload.old as { id: string }).id);
        setClosets((current) => current.map((closet) => ({ ...closet, items: closet.items.filter((item) => item.id !== deletedId) })));
      })
      .subscribe();

    async function loadRoomProducts() {
      const { data: placements, error } = await supabase.from("room_products").select("id, product_id, added_by, x, y").eq("room_id", roomId);
      if (cancelled) return;
      if (error) {
        setNotice(`Couldn't load room products: ${error.message}`);
        return;
      }
      setClosets((current) => current.map((closet) => ({ ...closet, items: [] })));
      await Promise.all((placements || []).map((placement) => hydratePlacement(placement)));
    }

    void loadRoomProducts();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [closets.length, room?.id]);

  useEffect(() => {
    if (!room?.id) return;
    const roomId = room.id;
    const channel = supabase
      .channel(`room-feedback:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_product_reactions", filter: `room_id=eq.${roomId}` }, (payload) => {
        const row = payload.new as { id: string; room_id: string; product_id: string; emoji: string };
        const feedback: FeedbackItem = { id: row.id, room_id: row.room_id, product_id: row.product_id, reaction: row.emoji, comment: "" };
        setAllFeedback((current) => current.some((item) => item.id === feedback.id) ? current : [...current, feedback]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_product_notes", filter: `room_id=eq.${roomId}` }, (payload) => {
        const row = payload.new as { id: string; room_id: string; product_id: string; body: string };
        const feedback: FeedbackItem = { id: row.id, room_id: row.room_id, product_id: row.product_id, reaction: "", comment: row.body };
        setAllFeedback((current) => current.some((item) => item.id === feedback.id) ? current : [...current, feedback]);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room?.id]);

  useEffect(() => {
    if (!room?.id) return;
    const roomId = room.id;
    let cancelled = false;

    async function loadFeedback() {
      const [{ data: reactions, error: reactionsError }, { data: notes, error: notesError }] = await Promise.all([
        supabase.from("room_product_reactions").select("id, room_id, product_id, emoji, created_at").eq("room_id", roomId).order("created_at", { ascending: true }),
        supabase.from("room_product_notes").select("id, room_id, product_id, body, created_at").eq("room_id", roomId).order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (reactionsError || notesError) setNotice(`Couldn't load feedback: ${reactionsError?.message || notesError?.message}`);
      else setAllFeedback([
        ...(reactions || []).map((row) => ({ id: row.id, room_id: row.room_id, product_id: row.product_id, reaction: row.emoji, comment: "" })),
        ...(notes || []).map((row) => ({ id: row.id, room_id: row.room_id, product_id: row.product_id, reaction: "", comment: row.body })),
      ]);
    }

    void loadFeedback();
    return () => {
      cancelled = true;
    };
  }, [room?.id]);

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

  function selectCloset(index: number) {
    if (index === closetIndex) return;
    setActiveId(null);
    setClosetIndex(index);
  }

  function updateForm(field: keyof ItemForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editItem(item: BoardItem) {
    setEditingItemId(item.id);
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
        productId: "",
        addedBy: activeCloset?.id,
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
      productId: "",
      addedBy: activeCloset?.id,
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
    if (draggingId) return;
    event.dataTransfer.dropEffect = "copy";
    setIsBoardDropActive(true);
  }

  function handleBoardDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsBoardDropActive(false);
    if (draggingId) return;
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

  async function addItem(event: FormEvent<HTMLFormElement>) {
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
      setForm(emptyForm);
      setPhotoPreview("");
      setNotice(`${form.name.trim()} updated.`);
      return;
    }

  const x = 10 + ((items.length * 17) % 70);
  const y = 12 + ((items.length * 23) % 58);

  if (!room) {
    setNotice("Room is still loading.");
    return;
  }

  // 1. Save product to Supabase products table
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name: form.name.trim(),
      image_url: form.imageUrl.trim(),
      category: form.category,
      price: Number(form.price.replace(/[^0-9.]/g, "")) || null,
    })
    .select("id, name, image_url, category, price")
    .single();

  if (productError || !product) {
    console.error("Products insert error:", productError);
    setNotice(productError?.message || "Couldn't save the product.");
    return;
  }

  // 2. Link product to current room in room_products
  const { data: placement, error: roomProductError } = await supabase
    .from("room_products")
    .insert({
      room_id: room.id,
      product_id: product.id,
      added_by: activeCloset.id,
      x,
      y,
    })
    .select("id")
    .single();

  if (roomProductError || !placement) {
    console.error("room_products insert error:", roomProductError);
    setNotice(roomProductError?.message || "Couldn't save the board placement.");
    return;
  }

  // 3. Update local state with saved product data
  const newItem: BoardItem = {
    id: placement.id,
    productId: product.id,
    addedBy: activeCloset.id,
    name: product.name,
    imageUrl: product.image_url || "",
    sourceUrl: form.sourceUrl.trim(),
    category: product.category || form.category,
    price: product.price ? `$${product.price}` : "Price TBD",
    x,
    y,
  };

  updateActiveItems((current) => [...current, newItem]);
  setActiveId(newItem.id);
  setEditingItemId(null);
  setForm(emptyForm);
  setPhotoPreview("");
  setNotice(`${newItem.name} added to the board.`);
  }


function startDrag(event: PointerEvent<HTMLElement>, item: BoardItem) {
  if (!boardRef.current) return;
  const bounds = boardRef.current.getBoundingClientRect();
  const centerX = bounds.left + (item.x / 100) * bounds.width;
  const centerY = bounds.top + (item.y / 100) * bounds.height;
  dragOffsetRef.current = { x: event.clientX - centerX, y: event.clientY - centerY };
  dragStartRef.current = { x: event.clientX, y: event.clientY, moved: false };
  event.currentTarget.setPointerCapture(event.pointerId);
  setDraggingId(item.id);
}

function moveItem(event: PointerEvent<HTMLDivElement>) {
  if (!draggingId || !boardRef.current) return;
  if (
    !dragStartRef.current.moved &&
    Math.hypot(
      event.clientX - dragStartRef.current.x,
      event.clientY - dragStartRef.current.y
    ) < 4
  )
    return;

  dragStartRef.current.moved = true;
  const bounds = boardRef.current.getBoundingClientRect();
  const card = event.currentTarget.querySelector<HTMLElement>(
    ".placed-item.is-dragging"
  );
  const halfW = (card?.offsetWidth ?? 132) / 2;
  const halfH = (card?.offsetHeight ?? 210) / 2;
  const centerX = Math.max(
    halfW,
    Math.min(bounds.width - halfW, event.clientX - bounds.left - dragOffsetRef.current.x)
  );
  const centerY = Math.max(
    halfH,
    Math.min(bounds.height - halfH, event.clientY - bounds.top - dragOffsetRef.current.y)
  );
  const x = (centerX / bounds.width) * 100;
  const y = (centerY / bounds.height) * 100;

  updateActiveItems((current) =>
    current.map((item) => (item.id === draggingId ? { ...item, x, y } : item))
  );
}

function endDrag() {
  setDraggingId(null);
}

async function finishPointer(item: BoardItem) {
  const wasClick = draggingId === item.id && !dragStartRef.current.moved;
  const wasMoved = dragStartRef.current.moved;

  endDrag();

  if (wasClick) {
    setActiveId(item.id);
    editItem(item);
    return;
  }

  // If dragged, save final position to room_products in Supabase
  if (wasMoved && room?.id) {
    const { error } = await supabase
      .from("room_products")
      .update({ x: item.x, y: item.y })
      .eq("room_id", room.id)
      .eq("id", item.id);

    if (error) {
      console.error("Failed to update item coordinates:", error.message);
    }
  }
}

async function removeItem(itemId: string) {
  updateActiveItems((current) => current.filter((item) => item.id !== itemId));
  setActiveId(null);
  setEditingItemId(null);

  if (room?.id) {
    const { error } = await supabase
      .from("room_products")
      .delete()
      .eq("room_id", room.id)
      .eq("id", itemId);

    if (error) {
      console.error("Failed to delete item from room:", error.message);
    }
  }

  setNotice("Piece removed from the board.");
}

  async function postFeedback(placementId: string, reaction = feedbackReaction, comment = feedbackComment.trim()) {
    if (!room?.id || isSavingFeedback) return;
    if (!comment && !reaction) {
      setNotice("Add a comment or choose a reaction first.");
      return;
    }

    setIsSavingFeedback(true);
    let persistedPlacementId = placementId;
    let persistedProductId = items.find((item) => item.id === placementId)?.productId || placementId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(placementId);

    if (!isUuid) {
      const localItem = items.find((item) => item.id === placementId);
      if (!localItem) {
        setIsSavingFeedback(false);
        setNotice("Select a saved board item before posting feedback.");
        return;
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          name: localItem.name,
          image_url: localItem.imageUrl,
          category: localItem.category,
          price: Number(localItem.price.replace(/[^0-9.]/g, "")) || null,
        })
        .select("id")
        .single();

      if (productError || !product) {
        setIsSavingFeedback(false);
        setNotice(`Couldn't save the board item: ${productError?.message || "Unknown error"}`);
        return;
      }

      const { data: placement, error: placementError } = await supabase
        .from("room_products")
        .insert({ room_id: room.id, product_id: product.id, added_by: activeCloset.id, x: localItem.x, y: localItem.y })
        .select("id")
        .single();

      if (placementError || !placement) {
        setIsSavingFeedback(false);
        setNotice(`Couldn't save the board placement: ${placementError.message}`);
        return;
      }

      persistedProductId = product.id;
      persistedPlacementId = placement.id;
      updateActiveItems((current) => current.map((item) => item.id === placementId ? { ...item, id: persistedPlacementId, productId: persistedProductId } : item));
      setActiveId(persistedPlacementId);
    }

    const [reactionResult, noteResult] = await Promise.all([
      reaction ? supabase.from("room_product_reactions").insert({ room_id: room.id, product_id: persistedProductId, user_id: guest?.id || "guest", user_name: guestName, emoji: reaction }).select("id, room_id, product_id, emoji").single() : Promise.resolve({ data: null, error: null }),
      comment ? supabase.from("room_product_notes").insert({ room_id: room.id, product_id: persistedProductId, user_id: guest?.id || "guest", user_name: guestName, body: comment }).select("id, room_id, product_id, body").single() : Promise.resolve({ data: null, error: null }),
    ]);
    const error = reactionResult.error || noteResult.error;
    setIsSavingFeedback(false);
    if (error) {
      console.error("Error posting feedback:", error?.message);
      setNotice(`Couldn't save feedback: ${error?.message || "Unknown error"}`);
      return;
    }
    const newFeedback = [
      reactionResult.data && { id: reactionResult.data.id, room_id: reactionResult.data.room_id, product_id: reactionResult.data.product_id, reaction: reactionResult.data.emoji, comment: "" },
      noteResult.data && { id: noteResult.data.id, room_id: noteResult.data.room_id, product_id: noteResult.data.product_id, reaction: "", comment: noteResult.data.body },
    ].filter(Boolean) as FeedbackItem[];
    setAllFeedback((current) => [...current, ...newFeedback.filter((item) => !current.some((existing) => existing.id === item.id))]);
    setFeedbackComment("");
    setNotice("Feedback posted!");
  }

  function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeId) void postFeedback(activeId);
  }

async function copyToClipboard(kind: "link" | "code") {
  await navigator.clipboard.writeText(
    kind === "link" ? `${window.location.origin}/room/${roomCode}` : roomCode
  );
  setCopied(kind);
  setTimeout(() => setCopied(null), 1800);
}

if (roomStatus === "not-found") {
    return (
      <main className="room-shell">
        <header className="room-header">
          <Link className="wordmark" href="/" aria-label="Back to intracloset home"><Logo className="wordmark-mark" />intracloset</Link>
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
        <Link className="wordmark" href="/" aria-label="Back to intracloset home"><Logo className="wordmark-mark" />intracloset</Link>
        <div className="room-heading">
          <span className="status-dot" />
          <div><span className="room-kicker">Shared moodboard{roomStatus === "offline" && " · offline"}</span><h1>{roomName}</h1></div>
        </div>
        <div className="room-actions-bar">
          <div className="room-people"><i className="avatar avatar-one">{guestName.slice(0, 1).toUpperCase()}</i><span>1 here</span></div>
          <button className="room-code" onClick={() => copyToClipboard("code")} title="Copy room code" aria-label="Copy room code"><span className="room-kicker">Code</span><strong>{copied === "code" ? "Copied" : room?.code || roomCode}</strong></button>
          <button className="outline-button" onClick={() => copyToClipboard("link")}>{copied === "link" ? "Copied" : "Share room"} <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <section className="room-layout">
        <div className="board-column">
          <div className="board-toolbar">
            <div><span className="live-mark">● LIVE</span><span className="toolbar-muted">Drag pieces to arrange your look</span></div>
            <span className="board-count">{closetLabel} · {items.length} pieces / ${total.toFixed(0)} total</span>
          </div>
          <div className="board-stage">
          <div className={`moodboard ${isBoardDropActive ? "is-drop-active" : ""}`} ref={boardRef} onPointerMove={moveItem} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={() => setIsBoardDropActive(false)} onDragOver={handleBoardDragOver} onDragLeave={() => setIsBoardDropActive(false)} onDrop={handleBoardDrop}>
            <div className="moodboard-grid" />
            <div className="moodboard-note">build<br /><em>the look</em></div>
            <div className="drop-hint"><strong>Drop a screenshot here</strong><span>or drag a clothing photo from your desktop</span></div>
            {!items.length && <div className="empty-closet"><strong>{activeCloset?.name} hasn&apos;t added anything yet.</strong><span>Use the form to add the first find to this closet.</span></div>}
            {items.map((item) => (
              <article
                className={`placed-item ${activeId === item.id ? "is-active" : ""} ${draggingId === item.id ? "is-dragging" : ""}`}
                key={item.id}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                onPointerDown={(event) => startDrag(event, item)}
                onPointerUp={() => finishPointer(item)}
                onPointerCancel={endDrag}
              >
                <div className="placed-image-wrap">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.name} draggable={false} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="image-placeholder">{item.category.slice(0, 1).toUpperCase()}</div>}
                </div>
                {activeId === item.id && <button className="remove-item" onPointerDown={(event) => event.stopPropagation()} onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}>×</button>}
                <div className="placed-meta"><strong>{item.name}</strong><span>{item.price} · {item.category}</span></div>
                {allFeedback.some((feedback) => feedback.product_id === item.productId && feedback.reaction) && <div className="board-feedback" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
                  <div className="reaction-bubbles" aria-label="Reactions">
                    {allFeedback.filter((feedback) => feedback.product_id === item.productId && feedback.reaction).slice(-3).map((feedback) => <button className="reaction-bubble" key={feedback.id} type="button" onClick={() => void postFeedback(item.id, feedback.reaction, "")} aria-label={feedback.reaction} title={feedback.comment || undefined}>{feedback.reaction}</button>)}
                  </div>
                  {allFeedback.some((feedback) => feedback.product_id === item.productId && feedback.comment) && <div className="note-hover-card" role="tooltip">
                    <span className="note-hover-label">Notes from the room</span>
                    {allFeedback.filter((feedback) => feedback.product_id === item.productId && feedback.comment).map((feedback) => <p key={feedback.id}>{feedback.comment}</p>)}
                  </div>}
                </div>}
              </article>
            ))}
          </div>
          <nav className="closet-tabs" aria-label="Closets in this room">
            {closets.map((closet, index) => (
              <button
                key={closet.id}
                type="button"
                className={`closet-tab ${index === closetIndex ? "is-active" : ""}`}
                onClick={() => selectCloset(index)}
                aria-pressed={index === closetIndex}
              >
                <span>{closet.id === "owner" ? "You" : closet.name}</span>
                <small>{closet.items.length}</small>
              </button>
            ))}
          </nav>
          </div>
        </div>

        <aside className="room-sidebar">
          {activeItem && <section className="feedback-panel" aria-label={`Feedback for ${activeItem.name}`}>
            <div className="feedback-heading"><span>Leave feedback</span><strong>{activeItem.name}</strong></div>
            <div className="reaction-row" aria-label="React to this piece">
              {reactionOptions.map((emoji) => {
                const count = allFeedback.filter((feedback) => feedback.product_id === activeItem.productId && feedback.reaction === emoji).length;
                return <button className={`reaction-button ${feedbackReaction === emoji ? "is-reacted" : ""}`} key={emoji} type="button" onClick={() => { setFeedbackReaction(emoji); void postFeedback(activeItem.id, emoji, ""); }} aria-label={`${emoji} reaction${count ? `, ${count}` : ""}`} title={count ? `${count} reaction${count === 1 ? "" : "s"}` : "React"}>{emoji}{count > 0 && <small>{count}</small>}</button>;
              })}
            </div>
            <div className="feedback-notes">
              {allFeedback.filter((feedback) => feedback.product_id === activeItem.productId && feedback.comment).map((feedback) => <article className="feedback-note" key={feedback.id}><p>{feedback.comment}</p></article>)}
            </div>
            <form className="note-form" onSubmit={submitFeedback}>
              <input value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} maxLength={280} placeholder="Say what you think..." aria-label="Write feedback" />
              <button type="submit" disabled={!feedbackComment.trim() || isSavingFeedback} aria-label="Post note">Post</button>
            </form>
          </section>}
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
            <div className="form-split"><div><label htmlFor="category">Category</label><select id="category" value={form.category} onChange={(event) => updateForm("category", event.target.value)}><option>tops</option><option>bottoms</option><option>shoes</option><option>outerwear</option><option>dresses</option><option>accessories</option></select></div><div><label htmlFor="price">Price</label><input id="price" value={form.price} onChange={(event) => updateForm("price", event.target.value)} placeholder="$120" /></div></div>
            <button className="add-button" type="submit"><span aria-hidden="true">{editingItemId ? "✓" : "+"}</span> {editingItemId ? "Save item details" : "Add to moodboard"}</button>
          </form>
          {notice && <p className="room-notice" role="status">{notice}</p>}
        </aside>
      </section>
    </main>
  );
}
