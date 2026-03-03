# PokerAI — Pointing Poker

AI-powered pointing poker for dev teams. Built with Next.js 14 + Supabase.

## Setup

### 1. Supabase
- Go to your Supabase project → SQL Editor
- Paste and run the contents of `supabase/migration.sql`
- Go to Settings → API and grab your Project URL and anon key

### 2. Environment
```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key
```

### 3. Install & Run
```bash
npm install
npm run dev
```

Open http://localhost:3000

### 4. Deploy to Vercel
- Connect your GitHub repo
- Add environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Deploy

## Architecture
- **Next.js 14** App Router — standard deployment (no custom server)
- **Supabase Postgres** — sessions, participants, tickets, votes
- **Supabase Realtime** — live updates via postgres_changes subscriptions
- **CSS Variables** — themeable UI with 6 built-in themes
