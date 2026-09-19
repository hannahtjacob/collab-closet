# AGENTS.md — Collaborative AI Shopping Room

## Mission

Build a polished, hackathon-ready web application for **real-time collaborative shopping and outfit creation**.

The core experience is a multiplayer shopping room where several users can join the same session, browse a product catalog, drag products onto a shared board, see each other's cursors and changes live, react and vote on items, create/remix outfits, and ask an AI stylist to recommend or directly modify the shared board.

This should feel like:

- Figma-style multiplayer collaboration
- Pinterest-style visual product discovery
- A lightweight social shopping room
- An AI stylist that can operate on the shared canvas, not just chat

The app should be immediately understandable in a 90-second hackathon demo.

---

# 1. Product Goal

A user should be able to:

1. Open the app.
2. Create a shopping room.
3. Share a room code/link with friends.
4. Have multiple users join from separate browsers.
5. See who is currently in the room.
6. See each user's live cursor.
7. Browse/search products.
8. Drag products onto a shared board.
9. Move and remove products.
10. See all changes sync in real time.
11. React to products.
12. Vote on products/outfits.
13. Group products into an outfit.
14. Remix an existing outfit.
15. Enter style preferences and budget.
16. Ask the AI stylist to improve the outfit.
17. Have the AI explain its reasoning.
18. Optionally let the AI actually add/remove/rearrange products on the shared board.
19. Save the final outfit.

The most important technical feature is **shared realtime state**.

The product catalog itself can be mocked for the hackathon.

---

# 2. Recommended Stack

Use this stack unless there is a strong implementation reason not to.

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- React Konva for the shared canvas / board
- Zustand for local client state if needed
- Socket.IO client for realtime events

## Backend

- Node.js
- Express
- TypeScript
- Socket.IO server

## Database

- PostgreSQL
- Prisma ORM

## Authentication

For hackathon speed:

- guest identity first
- optional Clerk or NextAuth later

A user should be able to enter a display name and immediately join.

Do not block the core demo on full authentication.

## AI

- OpenAI API
- structured tool/function calling
- server-side only

Never expose the OpenAI API key to the browser.

## Deployment

Preferred:

- frontend: Vercel
- backend: Railway or Render
- database: Railway Postgres, Neon, or Supabase Postgres

For local development, support:

```bash
npm install
npm run dev
```

If the project uses a monorepo, provide one root command that starts all required services.

---

# 3. Repository Structure

Prefer a clean monorepo.

Example:

```text
collab-shopping/
├── AGENTS.md
├── README.md
├── package.json
├── .env.example
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   └── room/
│   │   │       └── [roomId]/
│   │   │           └── page.tsx
│   │   ├── components/
│   │   │   ├── room/
│   │   │   │   ├── ShoppingBoard.tsx
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   ├── ProductTray.tsx
│   │   │   │   ├── UserCursor.tsx
│   │   │   │   ├── RoomHeader.tsx
│   │   │   │   ├── ReactionBubble.tsx
│   │   │   │   ├── OutfitCard.tsx
│   │   │   │   └── AIStylistPanel.tsx
│   │   │   └── ui/
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── socket.ts
│   │   │   └── api.ts
│   │   └── types/
│   │
│   └── server/
│       ├── src/
│       │   ├── index.ts
│       │   ├── socket/
│       │   │   ├── handlers.ts
│       │   │   └── rooms.ts
│       │   ├── routes/
│       │   ├── services/
│       │   │   ├── ai.ts
│       │   │   ├── roomService.ts
│       │   │   └── productService.ts
│       │   ├── db/
│       │   └── types/
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types.ts
│       │   ├── socket-events.ts
│       │   └── schemas.ts
│       └── package.json
│
└── prisma/
    └── schema.prisma
```

The exact layout may vary, but keep:

- frontend concerns separate
- backend concerns separate
- shared TypeScript types centralized
- socket event payloads typed
- AI logic server-side

---

# 4. Core Data Models

Use TypeScript types similar to these.

```ts
export type User = {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
};

export type ProductCategory =
  | "tops"
  | "bottoms"
  | "shoes"
  | "outerwear"
  | "dresses"
  | "accessories";

export type Product = {
  id: string;
  name: string;
  description?: string;
  image: string;
  price: number;
  category: ProductCategory;
  colors?: string[];
  styles?: string[];
};

export type PlacedProduct = {
  instanceId: string;
  productId: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  addedBy: string;
  zIndex?: number;
};

export type ReactionType = "heart" | "fire" | "laugh" | "dislike";

export type ProductReaction = {
  id: string;
  productInstanceId: string;
  userId: string;
  reaction: ReactionType;
  createdAt: string;
};

export type UserPreferences = {
  userId: string;
  colors: string[];
  styles: string[];
  budget?: number;
  dislikes?: string[];
};

export type Outfit = {
  id: string;
  roomId: string;
  name: string;
  createdBy: string;
  productInstanceIds: string[];
  parentOutfitId?: string;
  createdAt: string;
};

export type Room = {
  id: string;
  code: string;
  name: string;
  createdBy: string;
  users: User[];
  products: PlacedProduct[];
  outfits: Outfit[];
  createdAt: string;
};
```

---

# 5. Realtime Architecture

Use Socket.IO.

Each room maps to a Socket.IO room.

Example:

```ts
socket.join(roomId);
io.to(roomId).emit(...);
```

Do not implement collaboration by repeatedly polling the REST API.

REST may be used for persistence and initial loading, but active room updates should travel over WebSockets.

---

# 6. Socket Event Contract

Define all socket event names and payloads in a shared TypeScript file.

At minimum support:

```text
room:create
room:join
room:leave
room:state

presence:update
cursor:move

product:add
product:move
product:remove

reaction:add
vote:add

outfit:create
outfit:remix

preferences:update

ai:request
ai:thinking
ai:message
ai:action
ai:complete
ai:error
```

Example payloads:

```ts
type JoinRoomPayload = {
  roomId: string;
  user: User;
};

type CursorMovePayload = {
  roomId: string;
  userId: string;
  x: number;
  y: number;
};

type AddProductPayload = {
  roomId: string;
  placedProduct: PlacedProduct;
};

type MoveProductPayload = {
  roomId: string;
  instanceId: string;
  x: number;
  y: number;
};

type RemoveProductPayload = {
  roomId: string;
  instanceId: string;
};

type ReactionPayload = {
  roomId: string;
  productInstanceId: string;
  userId: string;
  reaction: ReactionType;
};
```

---

# 7. Realtime Behavior Requirements

## Joining

When a client joins:

1. assign or recover guest user identity
2. join Socket.IO room
3. send the full current room state to the new client
4. broadcast updated presence to existing clients

## Moving products

While dragging:

- optimistically update locally
- throttle network movement events
- broadcast movement to other clients

Do not send a movement event every animation frame.

A rate around 20–30 updates per second is enough.

On drag end:

- send final exact position
- persist final position

## Cursor movement

Cursor updates should also be throttled.

Target roughly:

```text
20 updates / second
```

Interpolate or smoothly animate remote cursor movement.

## Disconnects

If a client disconnects:

- remove the user from live presence
- broadcast presence update
- do not delete their products

---

# 8. Shared Board

Use React Konva or an equivalent canvas system.

The board should support:

- drag products
- click/select products
- remove products
- display remote selections if feasible
- floating reactions
- product labels/tooltips
- zoom only if easy
- responsive resizing

Do not spend excessive time implementing complex infinite-canvas mechanics.

The primary board can be a bounded canvas area.

---

# 9. Product Catalog

For the hackathon, use a local mock catalog.

Create:

```text
data/products.json
```

Include at least 50 products.

Aim for 60–100 if practical.

Each product should have:

- id
- name
- image
- price
- category
- colors
- styles

Categories:

- tops
- bottoms
- shoes
- outerwear
- dresses
- accessories

Support:

- text search
- category filters
- price display
- click or drag to board

Do not block implementation on retailer APIs.

Use royalty-free or generated placeholder product images.

If product images are unavailable, use polished local placeholders rather than broken URLs.

---

# 10. Landing Page

The landing page should be visually polished and minimal.

Include:

- product/app name
- short one-sentence explanation
- "Create room" CTA
- "Join room" input
- display name input
- small visual preview of collaborative board

Example product positioning:

> Shop together, even when you're apart.

Do not overload the landing page with feature cards.

The app should feel like a real product, not a hackathon dashboard.

---

# 11. Room UI Layout

Recommended desktop layout:

```text
┌────────────────────────────────────────────────────────────┐
│ room name       room code        avatars        share      │
├───────────────────────────────┬────────────────────────────┤
│                               │                            │
│                               │  AI Stylist / Details      │
│     SHARED SHOPPING BOARD     │                            │
│                               │  preferences               │
│                               │  recommendations           │
│                               │                            │
├───────────────────────────────┴────────────────────────────┤
│ search + product tray                                      │
│ [item] [item] [item] [item] [item]                        │
└────────────────────────────────────────────────────────────┘
```

Responsive behavior:

- desktop: board + AI sidebar
- tablet: sidebar collapsible
- mobile: board with bottom-sheet catalog

Desktop experience has priority for the hackathon demo.

---

# 12. Presence and Live Cursors

Every active user should have:

- a display name
- avatar initials or small avatar
- a consistent cursor color

Remote cursors should show:

```text
name
pointer
```

Example:

```text
     Maya
       ↘
        ●
```

Use subtle motion smoothing.

Presence avatars should display in the room header.

---

# 13. Reactions

Allow users to react to products with:

- ❤️
- 🔥
- 😂
- 👎

Reactions should appear briefly near the relevant product.

Keep them visually playful but not visually noisy.

Implementation:

```ts
socket.emit("reaction:add", {
  roomId,
  productInstanceId,
  userId,
  reaction
});
```

The server broadcasts the reaction.

Persisting reactions is optional.

Live display matters more than persistence.

---

# 14. Voting

Allow users to vote on:

- products
- outfits

Keep voting simple.

Example:

```ts
type Vote = {
  userId: string;
  targetId: string;
  targetType: "product" | "outfit";
  value: 1;
};
```

One vote per user per target.

Display vote count.

---

# 15. Outfit Creation

Users should be able to select multiple products and create an outfit.

Example:

```text
Select 3 products
→ Create Outfit
→ Give it a name
```

Store an outfit as references to placed product instances.

Outfits should appear in an outfit/history section.

---

# 16. Remix System

Every outfit can be remixed.

Clicking "Remix" should:

1. duplicate the outfit
2. set `parentOutfitId`
3. create a new editable version
4. optionally re-place those items on the board

Show lineage where feasible:

```text
Original
   ↓
Maya Remix
   ↓
Sam Remix
```

A compact history view is enough.

---

# 17. User Preferences

Each user can optionally set:

- preferred colors
- style tags
- max budget
- disliked styles/items

Example:

```json
{
  "colors": ["black", "cream", "red"],
  "styles": ["minimal", "streetwear"],
  "budget": 150
}
```

These preferences should be available to the AI stylist.

---

# 18. AI Stylist

The AI should understand:

- current room goal
- current board products
- all user preferences
- budget
- product catalog
- reactions/votes if available

The AI must never invent a catalog item that does not exist.

When recommending products, only return product IDs that exist in the local catalog.

---

# 19. AI Interaction Design

The AI panel should support prompts like:

```text
Make this less formal.
```

```text
Find a compromise that fits everyone's style.
```

```text
Keep us under $150 total.
```

```text
Make the outfit more vintage.
```

```text
Give us a concert outfit using what is already on the board.
```

The AI should return:

1. a short explanation
2. optionally a set of board actions

Example:

```text
I'd keep the black skirt and white sneakers.

I'm swapping the structured blazer for the denim jacket because it keeps
the outfit casual while preserving the neutral palette.
```

---

# 20. AI Tool Calling

The AI should be able to use server-side tools like:

```ts
addProduct(productId: string, x?: number, y?: number)

removeProduct(instanceId: string)

moveProduct(instanceId: string, x: number, y: number)

createOutfit(name: string, productInstanceIds: string[])
```

Do not let the model write arbitrary database queries or execute arbitrary code.

Only expose narrowly defined actions.

AI actions should be validated by the backend.

For example:

- `productId` must exist
- `instanceId` must exist in the room
- coordinates must be inside board bounds
- room ID comes from trusted server context, not model text

---

# 21. AI Action Flow

Use this pattern:

```text
User sends prompt
        ↓
Server gathers room state
        ↓
Server sends structured context to model
        ↓
Model returns explanation + tool calls
        ↓
Server validates tools
        ↓
Server mutates room state
        ↓
Socket.IO broadcasts mutations
        ↓
All users see board changes live
```

The AI should not directly call the browser.

The backend remains authoritative.

---

# 22. AI System Prompt Requirements

Use a server-side system prompt similar to:

```text
You are the AI stylist inside a collaborative shopping room.

Your goal is to help the group create outfits that balance:
- individual user preferences
- total budget
- current board context
- group reactions and votes

Only recommend products that exist in the provided catalog.

Do not invent product IDs.

When modifying the board, use the available tools.

Prefer minimal changes unless the user explicitly requests a full redesign.

When there are conflicting preferences, explain the compromise briefly.

Keep explanations concise and practical.
```

---

# 23. Persistence Strategy

Persist:

- rooms
- saved users if auth exists
- products
- placed products
- outfits
- preferences
- final positions

Realtime ephemeral state may stay in memory:

- cursor positions
- active connections
- temporary reactions
- selections

For a hackathon, an in-memory room state cache is acceptable.

Postgres should store durable state.

Do not introduce Redis unless needed after the core app works.

---

# 24. Prisma Schema Direction

Implement roughly:

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  avatar    String?
  createdAt DateTime @default(now())

  memberships RoomMember[]
  outfits     Outfit[]
}

model Room {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String
  createdAt DateTime @default(now())

  members   RoomMember[]
  placements PlacedProduct[]
  outfits    Outfit[]
}

model RoomMember {
  id      String @id @default(cuid())
  roomId  String
  userId  String

  room Room @relation(fields: [roomId], references: [id])
  user User @relation(fields: [userId], references: [id])

  @@unique([roomId, userId])
}

model Product {
  id          String @id
  name        String
  description String?
  image       String
  price       Float
  category    String
}

model PlacedProduct {
  id        String @id @default(cuid())
  roomId    String
  productId String
  addedBy   String

  x         Float
  y         Float
  rotation  Float @default(0)
  scale     Float @default(1)

  room      Room @relation(fields: [roomId], references: [id])
}

model Outfit {
  id             String   @id @default(cuid())
  roomId         String
  createdById    String
  name           String
  parentOutfitId String?
  createdAt      DateTime @default(now())

  room      Room @relation(fields: [roomId], references: [id])
  createdBy User @relation(fields: [createdById], references: [id])

  items OutfitItem[]
}

model OutfitItem {
  id        String @id @default(cuid())
  outfitId  String
  productId String

  outfit Outfit @relation(fields: [outfitId], references: [id])
}
```

Adjust as needed.

---

# 25. API Endpoints

Use a small REST API for initial/persistent data.

Suggested endpoints:

```text
POST   /api/rooms
GET    /api/rooms/:roomId
POST   /api/rooms/:roomId/join

GET    /api/products
GET    /api/products/:productId

GET    /api/rooms/:roomId/outfits
POST   /api/rooms/:roomId/outfits

POST   /api/rooms/:roomId/ai
```

Socket.IO handles realtime activity.

---

# 26. Room Codes

Room codes should be short and human-friendly.

Example:

```text
K7Q9D2
```

Use 5–6 uppercase alphanumeric characters.

Avoid ambiguous characters if easy:

```text
0 O
1 I L
```

Sharing should support:

- copy room code
- copy room URL

---

# 27. Optimistic UI

Realtime interaction must feel instant.

For local actions:

```text
local change
→ immediate UI update
→ send event
→ server acknowledges/broadcasts
```

Do not wait for a round trip before visually moving an item.

If persistence fails, show a subtle error and reconcile.

---

# 28. Conflict Handling

Keep conflict logic pragmatic.

For moving products:

- latest server-received position wins

For simultaneous edits:

- do not build CRDT infrastructure for the hackathon

The app should prioritize smooth collaboration over perfect distributed consistency.

---

# 29. Design Direction

The interface should feel intentional, modern, and product-quality.

Avoid the stereotypical "AI-generated hackathon UI."

Do not use:

- giant gradient hero headings
- excessive glassmorphism
- random purple/blue gradients everywhere
- too many cards inside cards
- oversized rounded rectangles for every section
- excessive shadows
- excessive pill-shaped controls
- fake analytics dashboards
- unnecessary animated gradients
- huge empty hero areas
- excessive emoji decoration

Prefer:

- restrained neutral palette
- one strong accent color
- clean typography
- visible hierarchy
- compact controls
- generous but purposeful whitespace
- subtle borders
- small shadows only where needed
- consistent spacing
- realistic product UI patterns
- polished hover states
- thoughtful empty states
- high information density where appropriate

The room should visually prioritize:

1. shared board
2. products
3. participants
4. AI stylist

The AI should feel integrated into the workflow, not like a chatbot pasted onto the side.

---

# 30. UX Details

Add these details if practical:

- room code copy confirmation
- online indicator next to avatars
- cursor labels
- snap-back if invalid drop
- hover toolbar on selected product
- delete keyboard shortcut
- escape to deselect
- subtle "Maya added sneakers" activity toast
- loading skeleton for catalog
- empty board hint
- tasteful animated reaction bubbles
- AI typing/thinking indicator
- undo last AI action if feasible

---

# 31. Demo Seed Data

Include a demo room / seed state.

Example:

```text
Room:
Concert Outfit

Users:
Ziana
Maya
Sam

Preferences:

Ziana:
- colorful
- casual
- budget $120

Maya:
- minimal
- neutral
- budget $100

Sam:
- vintage
- green
- budget $140
```

Preload several products so the demo does not begin from an empty screen.

---

# 32. Required Demo Scenario

The finished app must support this demonstration:

### Step 1

User creates:

```text
Concert Outfit
```

### Step 2

A second browser joins using the room code.

Both users appear in presence.

### Step 3

User A drags a jacket to the shared board.

User B sees it instantly.

### Step 4

User B drags sneakers onto the board.

User A sees them instantly.

### Step 5

Both users move their mice.

Each sees the other's cursor.

### Step 6

User A reacts 🔥 to the sneakers.

Reaction appears for both users.

### Step 7

User B changes style preferences.

### Step 8

User asks AI:

```text
Make this work for all three of us and keep the total under $150.
```

### Step 9

AI:

- explains the compromise
- adds/removes or swaps products
- modifies the shared board through validated actions

### Step 10

Users save the result as an outfit.

### Step 11

One user creates a remix.

The remix appears in outfit history.

This entire demo should feel smooth.

---

# 33. Implementation Priority

Build in this exact order unless a dependency requires otherwise.

## Phase 1 — Static Product Experience

Implement:

- Next.js app
- landing page
- room page
- product catalog
- shared board
- draggable products

Do not add AI yet.

Acceptance criterion:

> One browser can drag products around the board.

---

## Phase 2 — Multiplayer

Implement:

- Express backend
- Socket.IO
- room creation
- room joining
- presence
- shared product add/move/remove
- cursors

Acceptance criterion:

> Two separate browser windows stay synchronized.

---

## Phase 3 — Social Features

Implement:

- reactions
- voting
- outfit creation
- remixing
- simple activity feedback

Acceptance criterion:

> Two users can create and remix a shared outfit.

---

## Phase 4 — AI Stylist

Implement:

- preferences
- AI prompt endpoint
- structured tool calling
- recommendation explanations
- board actions
- realtime broadcasting of AI mutations

Acceptance criterion:

> An AI request can visibly modify the board for every connected user.

---

## Phase 5 — Persistence

Implement:

- Prisma
- PostgreSQL
- room persistence
- outfits
- preferences
- placed products

Acceptance criterion:

> Refreshing the page restores the room.

---

## Phase 6 — Polish

Implement:

- transitions
- responsive layout
- loading states
- clean errors
- onboarding hints
- seed/demo mode

---

# 34. Definition of Done

The project is not done until all of these are true:

- app builds without TypeScript errors
- no obvious console errors
- two browser sessions can join the same room
- live cursors work
- product additions sync
- product movement syncs
- product removal syncs
- reactions sync
- outfit creation works
- remixing works
- AI can read room context
- AI only references valid products
- AI can trigger validated board mutations
- AI changes propagate to everyone
- room state persists across refresh
- UI looks polished enough for a hackathon presentation
- README contains setup instructions
- `.env.example` exists
- seed script exists or seed data loads automatically
- basic tests exist for key realtime/server behavior

---

# 35. Testing

At minimum add:

## Unit tests

- room code generation
- catalog validation
- AI action validation
- budget calculation

## Integration tests

- room join
- product add
- product move
- product remove
- outfit create

## Manual multiplayer test

Open two browser windows:

```text
Window A
Window B
```

Verify:

```text
join
presence
cursor
add product
move product
reaction
AI mutation
```

All should update in both windows.

---

# 36. Error Handling

Handle gracefully:

- invalid room code
- disconnected socket
- server unavailable
- AI unavailable
- invalid AI product ID
- catalog loading error
- database unavailable

Do not crash the room for an AI failure.

If AI fails, collaboration should continue normally.

---

# 37. Environment Variables

Provide `.env.example`.

Example:

```bash
DATABASE_URL=

OPENAI_API_KEY=

NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000

PORT=4000
```

Never commit real secrets.

---

# 38. README Requirements

README should explain:

1. what the project does
2. core features
3. architecture
4. stack
5. local setup
6. environment variables
7. database setup
8. how to run frontend/backend
9. how to test multiplayer locally
10. how the AI tool system works
11. deployment notes
12. hackathon demo script

Include a small architecture diagram using Mermaid if useful.

---

# 39. Development Rules for Codex

While implementing:

- work incrementally
- keep the app runnable after each major phase
- reuse shared types
- do not duplicate socket event strings
- prefer strong TypeScript types
- do not use `any` unless unavoidable
- add comments only where logic is genuinely non-obvious
- do not overengineer
- avoid premature abstractions
- do not add Redis, Kubernetes, queues, or microservices unless required
- do not spend time building retailer integrations
- do not implement payments
- do not implement checkout
- do not implement complex auth before multiplayer works
- do not expose secrets to the client
- do not let AI execute arbitrary code
- do not let AI mutate state without validation
- preserve existing working behavior when adding new features

If an implementation decision is unclear, choose the simplest version that preserves the realtime demo.

---

# 40. Performance Targets

Hackathon-appropriate targets:

- room join feels near-instant
- dragging is smooth
- remote movement latency feels live
- AI response begins quickly
- UI remains responsive with 4–6 users
- board handles at least 30 placed products comfortably

Do not optimize for hundreds of simultaneous users.

---

# 41. Security Basics

Even though this is a hackathon:

- validate socket payloads
- validate room IDs
- validate product IDs
- keep API key server-side
- sanitize display names
- enforce reasonable payload size limits
- rate limit AI requests lightly if practical
- validate AI tool arguments
- never trust client-provided prices

The server/catalog is authoritative for pricing.

---

# 42. Nice-to-Haves

Only implement these after the full main demo works:

- undo/redo
- cursor trails
- image upload
- live chat
- AI-generated outfit names
- shared notes
- product annotations
- emoji stamps
- product comparison mode
- mobile optimization
- invite QR code
- retailer API integration
- save favorite products
- AI-generated mood boards

None of these should delay the core experience.

---

# 43. Final Hackathon Demo Script

Optimize the app for this sequence:

```text
0:00 — Create "Concert Outfit" room
0:10 — Friend joins from another laptop
0:20 — Both users drag products onto the board
0:30 — Friend moves one of the items
0:40 — Live cursors make collaboration obvious
0:45 — React 🔥 to an item
0:50 — Open AI stylist
0:55 — Ask:
       "Make this work for all three of us under $150."
1:05 — AI explains compromise
1:10 — AI changes the shared board
1:20 — Everyone sees changes live
1:25 — Save outfit
1:30 — Create remix
```

The judges should understand the concept without a long explanation.

---

# 44. First Task for Codex

Begin implementation now.

Do not only produce a plan.

Start by:

1. scaffolding the monorepo
2. creating the Next.js frontend
3. creating the Express + Socket.IO backend
4. defining shared TypeScript types and socket events
5. creating the local product catalog
6. implementing the landing page
7. implementing room creation/joining
8. implementing the first version of the shared draggable board
9. implementing realtime synchronization between two browser windows

After that, continue through the phases above until the complete MVP is working.

Whenever you encounter a choice between architectural elegance and getting the complete hackathon demo working reliably, prefer the reliable demo.

Do not stop after scaffolding. Continue implementing functional vertical slices.
