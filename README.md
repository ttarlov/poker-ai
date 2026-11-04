# AgilePoker — Planning Poker

**Live: [agilepoker.dev](https://agilepoker.dev)** · Support it: [buymeacoffee.com/agilepoker](https://buymeacoffee.com/agilepoker)

Real-time pointing poker for dev teams. Share a link, vote on tickets, reveal together. No accounts and no database: each room lives in its own Cloudflare Durable Object and is deleted after 24 hours of inactivity.

## How it works

```
Browser (Next.js on Vercel)  ──WebSocket──▶  Cloudflare Worker "poker-rooms"
  localStorage: your ID, name,                  /rooms/:code ──▶ one Durable Object per room
  last room snapshot                              • room state in its own SQLite storage
                                                  • authoritative for tickets, votes, reveal
                                                  • broadcasts a snapshot on every change
                                                  • deletes itself after 24h idle
```

- **Isolation:** each room code maps to its own Durable Object. A connection to one room cannot read or write another.
- **Hidden votes:** until a ticket is revealed, the server sends each participant only their own vote value; everyone else sees who has voted, not what.
- **Reconnects:** the browser keeps your participant ID, name, and the last room snapshot in localStorage. A reload or dropped connection renders the last state immediately, reconnects with backoff, and rejoins as the same person with your vote intact.
- **Room codes:** `XXXX-XXXX` from a 31-character alphabet, generated in the browser. Rooms can't be listed.

## Project layout

| Path | What it is |
|---|---|
| `app/`, `components/` | Next.js UI |
| `lib/store.tsx` | Client room state: WebSocket connection, optimistic updates, localStorage cache |
| `lib/auth-provider.tsx` | Guest identity (display name + random participant ID) |
| `shared/room-protocol.ts` | Message types and limits shared by client and server |
| `worker/` | Cloudflare Worker + `Room` Durable Object |
| `worker/src/slack.ts` | Slack `/poker` slash command and Add to Slack install |
| `slack/manifest.yml` | Slack app manifest |
| `app/api/jira/` | Optional Jira ticket import (off unless configured) |

## Local development

```bash
npm install
npm --prefix worker install

# terminal 1: room server on http://localhost:8787 (no Cloudflare account needed)
npm run dev:rooms

# terminal 2: app on http://localhost:3000
cp .env.local.example .env.local
npm run dev
```

Protocol test (needs the room server running):

```bash
npm --prefix worker run test:protocol
npm --prefix worker run test:slack   # needs SLACK_SIGNING_SECRET=local-test-secret in worker/.dev.vars
```

## Deploy

1. **Room server:** `cd worker && npx wrangler login && npx wrangler deploy`. Add your app's production origin to `ALLOWED_ORIGINS` in `worker/wrangler.jsonc` first.
2. **App:** the client defaults to `https://poker-rooms.pointing-poker.workers.dev`; set `NEXT_PUBLIC_ROOMS_URL` only to point somewhere else.

## Slack: `/poker`

`/poker PROJ-123 Login times out` creates a room with that ticket open for voting and posts a "Join and vote" button in the channel. `/poker` alone opens an empty room, a Jira issue URL links the ticket, and `/poker help` shows usage privately.

The app asks for the `commands` scope only. The reply goes back in the slash command's HTTP response, so no Slack tokens are stored; the Worker checks Slack's request signature (HMAC-SHA256, 5-minute replay window) on every call.

### Slack app setup

1. Create the app at [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From a manifest**, and paste `slack/manifest.yml`.
2. Give the Worker the secrets from **Basic Information → App Credentials**:
   ```bash
   cd worker
   npx wrangler secret put SLACK_SIGNING_SECRET
   npx wrangler secret put SLACK_CLIENT_SECRET
   ```
   and set `SLACK_CLIENT_ID` in `wrangler.jsonc` `vars` (it is public).
3. `npx wrangler deploy`, then **Install to Workspace** from the app settings to try it in your own workspace.
4. To let other workspaces install it, turn on **Manage Distribution → Public Distribution** and send people to `https://poker-rooms.pointing-poker.workers.dev/slack/install`.

## Optional: Jira import

Set `NEXT_PUBLIC_JIRA_ENABLED=1` plus `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` to show a "Load from Jira" tab when adding tickets. The token is server-side and belongs to whoever runs the deployment, so leave this off on public instances.
