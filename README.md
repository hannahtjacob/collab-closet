# intracloset

A shared closet for styling outfits with friends. Create a room, send the code, and everyone drops pieces onto the same board — with live updates, reactions, and notes on each item.

> Shop together, even when you're apart.

## Features

- **Rooms by code** — create a board, share a 6-character code, friends join instantly as guests.
- **Per-member closets** — each person in a room gets their own shelf; flip between them.
- **Add anything** — paste a product URL and it auto-fills the image, name, price, and category.
- **Drag to arrange** — positions persist to Supabase and sync live to everyone in the room.
- **Reactions and notes** — react with emoji or leave a comment on any item.
- **Phone sign-in** — sign in with an SMS code to find your boards again from any device.

## Stack

- Next.js 16 (App Router) + React + TypeScript
- Supabase — Postgres, Realtime, and phone/OTP auth (queried directly from the client)
- Plain CSS in `globals.css`

## Setup

Requires Node 20+ and a Supabase project.

```bash
npm install
```

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Both values are in the Supabase dashboard under **Project Settings → API**. Never put the service role key in a `NEXT_PUBLIC_` variable.

Run the migrations in `supabase/migrations/` from the Supabase SQL editor, then:

```bash
npm run dev
```

Web runs on http://localhost:3000, the API on http://localhost:4000.

Other commands: `npm run dev:web`, `npm run dev:server`, `npm run build`, `npm run lint`.
