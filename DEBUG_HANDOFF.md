# Collaborative Board Bug Handoff

## Scope

This report identifies the active code paths for:

- Loading `room_products` and joining them to `products`
- Supabase realtime subscriptions
- Feedback/reaction reads and writes
- Rendering reaction bubbles and notes
- Legacy feedback tables that are no longer referenced by the frontend

## Active frontend file

`apps/web/src/app/room/[roomId]/page.tsx`

## 1. Room product loading

Current code:

```ts
useEffect(() => {
  if (!room?.id || !activeCloset?.id) return;
  const roomId = room.id;
  const memberId = activeCloset.id;
  let cancelled = false;

  async function loadRoomProducts() {
    const { data: placements, error: placementsError } = await supabase
      .from("room_products")
      .select("product_id, x, y")
      .eq("room_id", roomId)
      .eq("member_id", memberId);

    if (placementsError) {
      setNotice(`Couldn't load room products: ${placementsError.message}`);
      return;
    }
    if (!placements?.length) return;

    const productIds = placements.map((placement) => placement.product_id);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, image_url, category, price")
      .in("id", productIds);

    if (productsError) {
      setNotice(`Couldn't load products: ${productsError.message}`);
      return;
    }
    if (cancelled || !products) return;

    const productsById = new Map(products.map((product) => [product.id, product]));
    const loadedItems: BoardItem[] = placements.flatMap((placement) => {
      const product = productsById.get(placement.product_id);
      if (!product) return [];
      return [{
        id: product.id,
        name: product.name,
        imageUrl: product.image_url || "",
        sourceUrl: "",
        category: product.category || "tops",
        price: product.price !== null && product.price !== undefined ? `$${product.price}` : "Price TBD",
        x: Number(placement.x) || 0,
        y: Number(placement.y) || 0,
      }];
    });

    setClosets((current) => current.map((closet) => {
      if (closet.id !== memberId) return closet;
      const fetchedIds = new Set(loadedItems.map((item) => item.id));
      const localOnlyItems = closet.items.filter((item) => !fetchedIds.has(item.id));
      return { ...closet, items: [...localOnlyItems, ...loadedItems] };
    }));
  }

  void loadRoomProducts();
  return () => {
    cancelled = true;
  };
}, [activeCloset?.id, room?.id]);
```

### Important findings

- The query is now filtered by both `room_id` and `member_id`.
- There is no realtime subscription for `room_products`.
- The loader returns early when Supabase has no placements, leaving local starter items in place.
- The UI closet IDs are local strings created in this file:

```ts
function createDefaultClosets(ownerName: string): Closet[] {
  return [
    { id: "owner", name: ownerName, items: [starterItems[0]] },
    { id: "maya", name: "Maya", items: [starterItems[1]] },
    { id: "sam", name: "Sam", items: [starterItems[2]] },
  ];
}
```

If `room_products.member_id` is a UUID foreign key to a real room member table, `owner`, `maya`, and `sam` are not valid member IDs. The frontend needs a mapping from each visible tab to the actual database member/closet/tab UUID before this filter can work reliably.

## 2. Room product writes

New product insert:

```ts
const { error: roomProductError } = await supabase
  .from("room_products")
  .insert({
    room_id: room.id,
    product_id: product.id,
    member_id: activeCloset.id,
    x,
    y,
  });
```

Starter-item promotion before feedback:

```ts
const { error: placementError } = await supabase
  .from("room_products")
  .insert({
    room_id: room.id,
    product_id: product.id,
    member_id: activeCloset.id,
    x: localItem.x,
    y: localItem.y,
  });
```

Move and delete are also scoped by `room_id`, `member_id`, and `product_id`:

```ts
.eq("room_id", room.id)
.eq("member_id", activeCloset.id)
.eq("product_id", item.id);
```

## 3. Realtime subscriptions

Current active realtime subscription:

```ts
useEffect(() => {
  if (!room?.id) return;
  const roomId = room.id;
  const channel = supabase
    .channel(`room-feedback:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "item_feedback",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const feedback = payload.new as FeedbackItem;
        setAllFeedback((current) =>
          current.some((item) => item.id === feedback.id)
            ? current
            : [...current, feedback]
        );
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}, [room?.id]);
```

### Important finding

There is no `postgres_changes` subscription for `room_products`. Products added or moved by another browser will not update this board through realtime. The current page only loads room products when `room.id` or the active closet changes.

## 4. Active feedback reads and writes

Feedback load:

```ts
const { data, error } = await supabase
  .from("item_feedback")
  .select("id, room_id, product_id, reaction, comment, created_at")
  .eq("room_id", roomId)
  .order("created_at", { ascending: true });
```

Feedback insert:

```ts
const { data, error } = await supabase
  .from("item_feedback")
  .insert({
    room_id: room.id,
    product_id: persistedProductId,
    reaction,
    comment,
  })
  .select("id, room_id, product_id, reaction, comment")
  .single();
```

### Important finding

The active frontend does not read from or write to `room_product_reactions` or `room_product_notes`. It uses only `item_feedback` for both reactions and comments.

## 5. Reaction rendering

Current board overlay:

```tsx
{allFeedback.some(
  (feedback) => feedback.product_id === item.id && feedback.reaction
) && (
  <div className="board-feedback">
    <div className="reaction-bubbles" aria-label="Reactions">
      {allFeedback
        .filter(
          (feedback) =>
            feedback.product_id === item.id && feedback.reaction
        )
        .slice(-3)
        .map((feedback) => (
          <button
            className="reaction-bubble"
            key={feedback.id}
            type="button"
            onClick={() =>
              void postFeedback(item.id, feedback.reaction, "")
            }
            aria-label={feedback.reaction}
            title={feedback.comment || undefined}
          >
            {feedback.reaction}
          </button>
        ))}
    </div>
  </div>
)}
```

### Finding

Reaction rendering is scoped by `feedback.product_id === item.id`. It is not currently showing every room reaction on every card. It renders the final three individual feedback rows and does not aggregate counts in the board bubbles.

The sidebar also correctly scopes counts to the selected item:

```ts
const count = allFeedback.filter(
  (feedback) =>
    feedback.product_id === activeItem.id &&
    feedback.reaction === emoji
).length;
```

## 6. Legacy and active migrations

Legacy tables in `supabase/migrations/001_board_feedback.sql`:

```sql
create table if not exists public.room_product_notes (...);
create table if not exists public.room_product_reactions (...);
```

Active table in `supabase/migrations/002_item_feedback.sql`:

```sql
create table if not exists public.item_feedback (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  reaction text not null,
  comment text not null default '',
  created_at timestamptz not null default now()
);
```

The frontend currently matches the second migration, not the first. The first migration is legacy/dead unless another app or SQL process outside this repository uses those tables.

## Recommended next fixes for the coding agent

1. Confirm the actual type and foreign-key target of `room_products.member_id`.
2. Replace local tab IDs (`owner`, `maya`, `sam`) with actual database member/closet/tab IDs, or use a text ownership column intentionally designed for those IDs.
3. Subscribe to `room_products` INSERT/UPDATE/DELETE events, filtered by `room_id` and active member ID.
4. Merge realtime room-product events by stable `product_id`; never replace the entire items array with one incoming row.
5. Decide on one feedback model. The current frontend uses `item_feedback`; remove or formally migrate the legacy tables if they are not used elsewhere.
6. On initial load, subscribe before or alongside the fetch and merge by stable IDs to avoid missing products added during the fetch/listener race.
